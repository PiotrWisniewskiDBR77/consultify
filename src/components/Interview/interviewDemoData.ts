const DAY_MS = 24 * 60 * 60 * 1000;

export const INTERVIEW_DEMO_PREFIX = 'demo-interview';

type InterviewCategory = 'strategy' | 'operations' | 'digital' | 'people' | 'finance';
type TemplateScope = 'system' | 'organization' | 'private';
type TemplateCategory =
  | 'DIGITAL'
  | 'OPERATIONAL'
  | 'COST'
  | 'DATA'
  | 'STANDARD'
  | 'QUICK'
  | 'CUSTOM';
type QuestionStatus = 'not_started' | 'in_progress' | 'answered' | 'needs_follow_up';
type SessionStatus = 'active' | 'completed' | 'archived';
type AssignmentStatus =
  | 'assigned'
  | 'in_progress'
  | 'submitted'
  | 'sent_back'
  | 'approved'
  | 'completed';
type InsightPromptType =
  | 'summary'
  | 'trends'
  | 'problems'
  | 'recommendations'
  | 'comparison'
  | 'gaps'
  | 'risk_assessment'
  | 'opportunity_scan'
  | 'maturity'
  | 'stakeholder_map';

interface DemoInterviewContext {
  currentUserId?: string;
  currentUserName?: string;
  currentUserEmail?: string;
  organizationId?: string;
  organizationName?: string;
}

interface DemoTemplateQuestionBlueprint {
  category: InterviewCategory;
  questionText: string;
  answerType?: string;
  expectedAnswerShape?: string;
  evidencePrompt?: string;
  answerOptions?: string[];
}

interface DemoTemplateBlueprint {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  scope: TemplateScope;
  audience: string;
  estimatedTimeMinutes: number;
  runtimeModeDefault: 'task_list' | 'one_question_per_screen';
  areaTags: string[];
  isDefault: boolean;
  status: 'draft' | 'approved';
  createdAt: string;
  updatedAt: string;
  sessionsUsed: number;
  questions: DemoTemplateQuestionBlueprint[];
}

interface DemoSessionAnswer {
  answerText?: string;
  status?: QuestionStatus;
  confidenceScore?: number;
  notes?: string;
  contextNote?: string;
  tags?: string[];
  answeredBy?: string;
  answeredAt?: string;
}

interface DemoSessionDetailBlueprint {
  id: string;
  name: string;
  templateId: string;
  status: SessionStatus;
  ownerId: string;
  startedAt: string;
  completedAt?: string;
  lastActivityAt: string;
  projectId?: string;
  assignmentId?: string;
  templateName?: string;
  companyProfile: {
    name: string;
    industry: string;
    size: string;
    location: string;
    employees: number;
    revenue: string;
  };
  summary: {
    facts: string[];
    gaps: string[];
    constraints: string[];
    painPoints: string[];
  };
  notes: Array<{
    id: string;
    category?: InterviewCategory | 'general';
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
  }>;
  evidence: Array<{
    id: string;
    questionIndex?: number;
    category?: InterviewCategory;
    evidenceType: 'file' | 'link' | 'comment' | 'audio';
    evidenceRole?: string;
    title?: string;
    name: string;
    url?: string;
    description?: string;
    fileSize?: number;
    fileType?: string;
    mimeType?: string;
    transcriptText?: string;
    uploadedBy?: string;
    uploadedAt: string;
  }>;
  linkedItems?: Array<{
    id: string;
    type: 'task' | 'initiative' | 'decision' | 'assessment';
    title: string;
    status?: string;
    edgeId?: string;
  }>;
  answers: DemoSessionAnswer[];
}

interface DemoAssignmentBlueprint {
  id: string;
  templateId: string;
  sessionId: string;
  status: AssignmentStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueAt: string;
  createdAt: string;
  updatedAt: string;
  assignee: {
    id: string;
    name: string;
    email: string;
  };
  sentBackReason?: string;
}

interface DemoInsightBlueprint {
  id: string;
  title: string;
  promptType: InsightPromptType;
  status: 'generating' | 'completed' | 'failed';
  confidence: string;
  createdAt: string;
  updatedAt: string;
  sourceSessionIds: string[];
  exportedToTools?: boolean;
  exportedToAssessment?: boolean;
  executiveSummary: string;
  content: string;
  themes?: Array<{
    title: string;
    description: string;
    evidence_refs: string[];
    strength: 'strong' | 'moderate' | 'weak';
  }>;
  issues?: Array<{
    title: string;
    description: string;
    severity: 'high' | 'medium' | 'low';
    evidence_refs: string[];
  }>;
  opportunities?: Array<{
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    evidence_refs: string[];
  }>;
  signals?: Array<{
    title: string;
    description: string;
    type: 'tension' | 'gap' | 'contradiction' | 'emerging_pattern';
  }>;
  evidenceMap?: Array<{
    answer_id: string;
    question_text: string;
    answer_snippet: string;
    linked_themes: string[];
    linked_issues: string[];
  }>;
  missingData?: string[];
  comments?: Array<{
    id: string;
    authorName: string;
    content: string;
    createdAt: string;
    priority?: 'low' | 'normal' | 'high';
  }>;
  activity?: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
    userName?: string;
    oldValue?: string;
    newValue?: string;
  }>;
}

const isoDaysAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString();
const isoDaysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString();

const makeDemoId = (value: string) => `${INTERVIEW_DEMO_PREFIX}-${value}`;

export const isInterviewDemoId = (value?: string | null): boolean =>
  typeof value === 'string' && value.startsWith(INTERVIEW_DEMO_PREFIX);

const TEMPLATE_BLUEPRINTS: DemoTemplateBlueprint[] = [
  {
    id: makeDemoId('template-digital-maturity'),
    name: 'Digital Readiness Review',
    description:
      'A structured interview for understanding current digital capabilities, delivery bottlenecks, and leadership appetite for change.',
    category: 'DIGITAL',
    scope: 'system',
    audience: 'Executive sponsor, CIO, digital lead',
    estimatedTimeMinutes: 40,
    runtimeModeDefault: 'one_question_per_screen',
    areaTags: ['digital', 'strategy'],
    isDefault: true,
    status: 'approved',
    createdAt: isoDaysAgo(90),
    updatedAt: isoDaysAgo(12),
    sessionsUsed: 9,
    questions: [
      {
        category: 'strategy',
        questionText:
          'What outcomes does leadership expect from the digital roadmap over the next 12 months?',
        expectedAnswerShape: 'Outcome list with timelines and business owners.',
      },
      {
        category: 'digital',
        questionText:
          'Which customer journeys are most critical today, and where does digital friction appear?',
        expectedAnswerShape: 'Journey, pain point, impact, current workaround.',
      },
      {
        category: 'operations',
        questionText:
          'How long does it currently take to move a digital idea from request to release?',
        answerType: 'number',
        expectedAnswerShape: 'Lead time in weeks plus major blockers.',
      },
      {
        category: 'people',
        questionText: 'Which teams own product decisions, delivery, and adoption?',
        expectedAnswerShape: 'Named roles, decision rights, escalation path.',
      },
      {
        category: 'finance',
        questionText: 'How is digital investment prioritized and tracked today?',
        expectedAnswerShape: 'Funding model, review cadence, success metrics.',
      },
      {
        category: 'digital',
        questionText: 'What platforms or data assets create the biggest dependency risks?',
        expectedAnswerShape: 'List of systems with risk description and business impact.',
      },
    ],
  },
  {
    id: makeDemoId('template-operating-model'),
    name: 'Operational Excellence Audit',
    description:
      'Assesses process ownership, handoff quality, capacity planning, and KPI discipline in a core operating flow.',
    category: 'OPERATIONAL',
    scope: 'system',
    audience: 'COO, operations manager, process owner',
    estimatedTimeMinutes: 35,
    runtimeModeDefault: 'task_list',
    areaTags: ['operations'],
    isDefault: true,
    status: 'approved',
    createdAt: isoDaysAgo(88),
    updatedAt: isoDaysAgo(9),
    sessionsUsed: 7,
    questions: [
      {
        category: 'operations',
        questionText:
          'Which process is in scope, and where does work most often wait or loop back?',
        expectedAnswerShape: 'Process map with wait points and rework examples.',
      },
      {
        category: 'operations',
        questionText:
          'Which KPI best describes throughput, quality, and service reliability today?',
        expectedAnswerShape: 'Three metrics with baseline values and owner.',
      },
      {
        category: 'people',
        questionText:
          'Where do frontline teams rely on tribal knowledge instead of a documented standard?',
        expectedAnswerShape: 'Examples of undocumented work and resulting risk.',
      },
      {
        category: 'finance',
        questionText: 'What is the rough cost of current inefficiency or error handling?',
        expectedAnswerShape: 'Annual cost estimate or unit cost proxy.',
      },
      {
        category: 'digital',
        questionText:
          'Which tools are most involved in the workflow, and where is data re-entered manually?',
        expectedAnswerShape: 'System list plus manual re-entry points.',
      },
      {
        category: 'strategy',
        questionText: 'What improvement target would matter enough for leaders to sponsor change?',
        expectedAnswerShape: 'Target metric, threshold, and executive owner.',
      },
    ],
  },
  {
    id: makeDemoId('template-stakeholder-sprint'),
    name: 'Rapid Stakeholder Discovery',
    description:
      'Fast discovery session used in early project shaping to capture expectations, concerns, and decision dynamics.',
    category: 'QUICK',
    scope: 'system',
    audience: 'Project sponsor, workstream lead, subject matter expert',
    estimatedTimeMinutes: 25,
    runtimeModeDefault: 'one_question_per_screen',
    areaTags: ['strategy', 'people'],
    isDefault: true,
    status: 'approved',
    createdAt: isoDaysAgo(85),
    updatedAt: isoDaysAgo(15),
    sessionsUsed: 12,
    questions: [
      {
        category: 'strategy',
        questionText: 'What would make this project a clear success in your view?',
      },
      {
        category: 'people',
        questionText:
          'Which stakeholder groups are most likely to support or resist the initiative?',
      },
      {
        category: 'operations',
        questionText: 'What decisions are currently blocked because evidence is missing?',
      },
      {
        category: 'digital',
        questionText: 'What information should the team see weekly to stay aligned?',
      },
      {
        category: 'finance',
        questionText: 'Where do you expect the strongest value case to come from?',
      },
      {
        category: 'people',
        questionText: 'What communication style works best with the key sponsor?',
      },
    ],
  },
  {
    id: makeDemoId('template-cost-optimization'),
    name: 'Cost Optimization Review',
    description:
      'Interview used to uncover structural cost drivers, avoidable spend, and quick decision opportunities.',
    category: 'COST',
    scope: 'system',
    audience: 'CFO, finance business partner, ops lead',
    estimatedTimeMinutes: 30,
    runtimeModeDefault: 'task_list',
    areaTags: ['finance', 'operations'],
    isDefault: false,
    status: 'approved',
    createdAt: isoDaysAgo(70),
    updatedAt: isoDaysAgo(6),
    sessionsUsed: 5,
    questions: [
      {
        category: 'finance',
        questionText: 'Which three cost pools have moved most in the last two quarters?',
      },
      {
        category: 'operations',
        questionText: 'Where do teams spend time on low-value coordination or reporting?',
      },
      {
        category: 'digital',
        questionText: 'Which recurring tools or vendors feel underused today?',
      },
      {
        category: 'people',
        questionText: 'Which roles are stretched and which work looks duplicative?',
      },
      {
        category: 'strategy',
        questionText: 'What savings target feels realistic without harming service quality?',
      },
      {
        category: 'finance',
        questionText: 'How are savings currently validated after implementation?',
      },
    ],
  },
  {
    id: makeDemoId('template-data-analytics'),
    name: 'Data & Analytics Readiness',
    description:
      'Evaluates decision-useful data, ownership, reporting trust, and the maturity of analytics delivery.',
    category: 'DATA',
    scope: 'system',
    audience: 'Head of data, analytics manager, process owner',
    estimatedTimeMinutes: 32,
    runtimeModeDefault: 'one_question_per_screen',
    areaTags: ['data', 'digital'],
    isDefault: false,
    status: 'approved',
    createdAt: isoDaysAgo(68),
    updatedAt: isoDaysAgo(4),
    sessionsUsed: 6,
    questions: [
      {
        category: 'strategy',
        questionText: 'Which decisions would improve first if data quality were trusted?',
      },
      {
        category: 'digital',
        questionText: 'What data source is most contested or manually corrected today?',
        answerType: 'open',
      } as DemoTemplateQuestionBlueprint,
      {
        category: 'digital',
        questionText: 'Where do people still export to spreadsheets before taking action?',
      },
      {
        category: 'operations',
        questionText: 'What is the current turnaround time for a new reporting request?',
      },
      {
        category: 'people',
        questionText: 'Who owns data definitions and issue triage across functions?',
      },
      {
        category: 'finance',
        questionText: 'How is analytics value tracked beyond dashboard usage?',
      },
    ],
  },
  {
    id: makeDemoId('template-onboarding'),
    name: 'Customer Onboarding Flow Review',
    description:
      'Maps delays, quality gaps, and ownership ambiguity in the end-to-end onboarding journey.',
    category: 'STANDARD',
    scope: 'system',
    audience: 'Commercial ops, service delivery, customer success',
    estimatedTimeMinutes: 28,
    runtimeModeDefault: 'task_list',
    areaTags: ['operations', 'customer'],
    isDefault: false,
    status: 'approved',
    createdAt: isoDaysAgo(64),
    updatedAt: isoDaysAgo(3),
    sessionsUsed: 4,
    questions: [
      {
        category: 'operations',
        questionText: 'Where does the onboarding clock really start and stop today?',
      },
      {
        category: 'people',
        questionText: 'Which handoff creates the most confusion between sales and delivery?',
      },
      {
        category: 'digital',
        questionText: 'Which onboarding steps are still tracked outside the core workflow tool?',
      },
      {
        category: 'finance',
        questionText: 'How much revenue is delayed when onboarding slips by two weeks?',
      },
      {
        category: 'strategy',
        questionText: 'What customer experience promise matters most in the first 30 days?',
      },
      {
        category: 'operations',
        questionText: 'Which onboarding cases require repeated clarification from the client?',
      },
    ],
  },
  {
    id: makeDemoId('template-frontline-productivity'),
    name: 'Frontline Productivity Pulse',
    description:
      'Short-form interview for understanding frontline workload, schedule loss, and coaching needs.',
    category: 'QUICK',
    scope: 'system',
    audience: 'Site manager, team lead, supervisor',
    estimatedTimeMinutes: 20,
    runtimeModeDefault: 'one_question_per_screen',
    areaTags: ['people', 'operations'],
    isDefault: false,
    status: 'approved',
    createdAt: isoDaysAgo(61),
    updatedAt: isoDaysAgo(2),
    sessionsUsed: 3,
    questions: [
      {
        category: 'people',
        questionText: 'What most often prevents the team from having a predictable day?',
      },
      {
        category: 'operations',
        questionText: 'Which recurring interruptions create avoidable rework?',
      },
      {
        category: 'digital',
        questionText: 'Where does the team need faster information or clearer task visibility?',
      },
      {
        category: 'people',
        questionText: 'What coaching topic would improve confidence fastest?',
      },
      {
        category: 'finance',
        questionText: 'What cost do you associate with current absenteeism or churn?',
      },
      {
        category: 'strategy',
        questionText: 'Which productivity gain would be most visible to leadership this quarter?',
      },
    ],
  },
  {
    id: makeDemoId('template-ai-copilot'),
    name: 'AI Copilot Adoption Review',
    description:
      'Looks at current use cases, workflow fit, confidence, and guardrails for AI assistance.',
    category: 'DIGITAL',
    scope: 'system',
    audience: 'Transformation lead, function lead, enablement manager',
    estimatedTimeMinutes: 30,
    runtimeModeDefault: 'one_question_per_screen',
    areaTags: ['digital', 'productivity'],
    isDefault: false,
    status: 'approved',
    createdAt: isoDaysAgo(58),
    updatedAt: isoDaysAgo(1),
    sessionsUsed: 4,
    questions: [
      {
        category: 'strategy',
        questionText: 'What decisions led you to prioritize AI copilots now?',
      },
      {
        category: 'digital',
        questionText: 'Which role has the clearest high-volume use case for an AI copilot?',
      },
      {
        category: 'people',
        questionText: 'What concerns are teams expressing about quality, trust, or workload shift?',
      },
      {
        category: 'operations',
        questionText: 'How will you measure whether the copilot actually saves time?',
      },
      {
        category: 'finance',
        questionText: 'What budget or ROI threshold would justify a broader rollout?',
      },
      {
        category: 'digital',
        questionText: 'Which data or policy constraints must be solved before scaling usage?',
      },
    ],
  },
  {
    id: makeDemoId('template-working-capital'),
    name: 'Working Capital Diagnostic',
    description:
      'Focused template for receivables, inventory, and payable discipline across commercial and operations stakeholders.',
    category: 'COST',
    scope: 'system',
    audience: 'CFO, controller, supply chain lead',
    estimatedTimeMinutes: 34,
    runtimeModeDefault: 'task_list',
    areaTags: ['finance', 'supply_chain'],
    isDefault: false,
    status: 'approved',
    createdAt: isoDaysAgo(54),
    updatedAt: isoDaysAgo(5),
    sessionsUsed: 2,
    questions: [
      {
        category: 'finance',
        questionText: 'Which working capital metric gets the most leadership attention today?',
      },
      {
        category: 'operations',
        questionText:
          'What operational pattern most often drives excess inventory or slow billing?',
      },
      {
        category: 'people',
        questionText: 'Where is ownership blurred between finance, sales, and operations?',
      },
      {
        category: 'digital',
        questionText: 'Which report or alert would allow earlier intervention?',
      },
      {
        category: 'strategy',
        questionText: 'What release of cash would materially change investment flexibility?',
      },
      {
        category: 'finance',
        questionText: 'What exception policy repeatedly gets waived today?',
      },
    ],
  },
  {
    id: makeDemoId('template-transformation-pulse'),
    name: 'Transformation Pulse Check',
    description:
      'A manager-facing pulse interview to assess alignment, momentum, and execution risk in a transformation program.',
    category: 'CUSTOM',
    scope: 'system',
    audience: 'Program manager, sponsor, workstream owner',
    estimatedTimeMinutes: 22,
    runtimeModeDefault: 'one_question_per_screen',
    areaTags: ['strategy', 'execution'],
    isDefault: false,
    status: 'approved',
    createdAt: isoDaysAgo(49),
    updatedAt: isoDaysAgo(1),
    sessionsUsed: 3,
    questions: [
      {
        category: 'strategy',
        questionText: 'Which part of the transformation feels most on track right now?',
      },
      {
        category: 'people',
        questionText: 'Where is alignment weaker than the steering narrative suggests?',
      },
      {
        category: 'operations',
        questionText: 'Which workstream has the biggest risk of slipping this month?',
      },
      {
        category: 'digital',
        questionText: 'What tooling or reporting gap is slowing escalation?',
      },
      {
        category: 'finance',
        questionText: 'Which benefits line is least evidenced today?',
      },
      {
        category: 'people',
        questionText: 'What sponsor behavior would accelerate momentum immediately?',
      },
    ],
  },
];

const owner = (id: string, name: string, email: string) => ({ id, name, email });

const buildInsightMarkdown = (
  heading: string,
  summary: string,
  findings: string[],
  risks: string[],
  actions: string[],
  quote?: string
) =>
  [
    `# ${heading}`,
    '',
    summary,
    '',
    '## Key Findings',
    ...findings.map((item) => `- ${item}`),
    '',
    quote ? `> "${quote}"` : null,
    quote ? '' : null,
    '## Risks',
    ...risks.map((item) => `- ${item}`),
    '',
    '## Recommended Actions',
    ...actions.map((item, index) => `${index + 1}. ${item}`),
  ]
    .filter(Boolean)
    .join('\n');

const buildTemplateQuestions = (template: DemoTemplateBlueprint) =>
  template.questions.map((question, index) => ({
    id: makeDemoId(`template-question-${template.id}-${index + 1}`),
    templateId: template.id,
    category: question.category,
    questionText: question.questionText,
    sortOrder: index + 1,
    answerType: question.answerType || 'open',
    isRequired: true,
    helpHint: question.expectedAnswerShape,
    answerOptions: question.answerOptions || [],
    expectedAnswerShape: question.expectedAnswerShape,
    allowVoice: true,
    allowFileUpload: true,
    allowUrl: true,
    allowContextNote: true,
    evidencePrompt:
      question.evidencePrompt ||
      'Attach evidence, comments, or a source that validates the answer.',
    description: question.expectedAnswerShape,
  }));

const SESSION_BLUEPRINTS: DemoSessionDetailBlueprint[] = [
  {
    id: makeDemoId('session-northstar'),
    name: 'NorthStar Logistics - Digital Readiness',
    templateId: makeDemoId('template-digital-maturity'),
    status: 'completed',
    ownerId: owner('owner-elaine', 'Elaine Porter', 'elaine.porter@consultify.demo').id,
    startedAt: isoDaysAgo(26),
    completedAt: isoDaysAgo(24),
    lastActivityAt: isoDaysAgo(24),
    projectId: 'demo-project-transport',
    companyProfile: {
      name: 'NorthStar Logistics',
      industry: 'Transportation & Logistics',
      size: '501-1000',
      location: 'Chicago, USA',
      employees: 780,
      revenue: '$180M',
    },
    summary: {
      facts: [
        'Leadership has a funded digital roadmap but no common sequencing logic across workstreams.',
        'Release lead time averages 11 weeks because data, product, and operations approvals happen serially.',
        'Customer self-service is strongest in shipment tracking and weakest in exception handling.',
      ],
      gaps: [
        'No single baseline for digital adoption by branch or customer segment.',
        'Benefits tracking is still project-specific rather than portfolio-level.',
      ],
      constraints: [
        'Core transport system changes require vendor coordination.',
        'Analytics team capacity is shared across six business initiatives.',
      ],
      painPoints: [
        'Operations teams create side spreadsheets to reconcile service exceptions.',
        'Leaders receive different versions of performance metrics in weekly reviews.',
      ],
    },
    notes: [
      {
        id: makeDemoId('note-northstar-1'),
        category: 'digital',
        title: 'Digital leadership signal',
        content:
          'The CIO and COO agree on the need for a simpler roadmap, but branch leaders still push local priorities into the queue.',
        createdAt: isoDaysAgo(25),
        updatedAt: isoDaysAgo(25),
        createdBy: 'Elaine Porter',
      },
      {
        id: makeDemoId('note-northstar-2'),
        category: 'operations',
        title: 'Workflow friction',
        content:
          'Exception handling crosses four teams and no one owns the full cycle time from issue raised to customer update.',
        createdAt: isoDaysAgo(24),
        updatedAt: isoDaysAgo(24),
        createdBy: 'Elaine Porter',
      },
    ],
    evidence: [
      {
        id: makeDemoId('evidence-northstar-1'),
        questionIndex: 1,
        category: 'digital',
        evidenceType: 'link',
        title: 'Roadmap steering deck',
        name: 'NorthStar Q2 digital steering deck',
        url: 'https://example.com/northstar-roadmap',
        description: 'Used to validate current program structure and release commitments.',
        uploadedBy: 'Elaine Porter',
        uploadedAt: isoDaysAgo(25),
      },
      {
        id: makeDemoId('evidence-northstar-2'),
        questionIndex: 2,
        category: 'operations',
        evidenceType: 'comment',
        name: 'Branch operations note',
        description:
          'Regional managers still escalate service exceptions through email because the workflow tool does not route accountability clearly.',
        uploadedBy: 'Elaine Porter',
        uploadedAt: isoDaysAgo(24),
      },
    ],
    linkedItems: [
      {
        id: makeDemoId('task-northstar-1'),
        type: 'task',
        title: 'Define release governance for digital roadmap',
        status: 'In review',
        edgeId: makeDemoId('edge-northstar-1'),
      },
    ],
    answers: [
      {
        answerText:
          'Leadership expects faster exception resolution, more self-service on customer issues, and one portfolio narrative for digital investment decisions.',
        status: 'answered',
        confidenceScore: 5,
        tags: ['opportunity', 'priority'],
        answeredBy: 'Elaine Porter',
        answeredAt: isoDaysAgo(25),
      },
      {
        answerText:
          'Shipment tracking works well, but claims, delayed delivery updates, and appointment changes still require phone calls or email escalation.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['risk', 'opportunity'],
        answeredBy: 'Elaine Porter',
        answeredAt: isoDaysAgo(25),
      },
      {
        answerText:
          'Average lead time is about 11 weeks. Security review, data validation, and branch sign-off happen one after another rather than in parallel.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['constraint'],
        answeredBy: 'Elaine Porter',
        answeredAt: isoDaysAgo(24),
      },
      {
        answerText:
          'Product owns priorities, IT delivery owns release execution, and operations owns adoption by branch. Escalation sits with the COO sponsor.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['priority'],
        answeredBy: 'Elaine Porter',
        answeredAt: isoDaysAgo(24),
      },
      {
        answerText:
          'Funding is approved quarterly with light benefits review. There is no consistent portfolio scorecard after launch.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['risk'],
        answeredBy: 'Elaine Porter',
        answeredAt: isoDaysAgo(24),
      },
      {
        answerText:
          'The transport management system and customer data warehouse are the biggest dependencies because both require specialist support to change.',
        status: 'answered',
        confidenceScore: 5,
        tags: ['constraint', 'risk'],
        answeredBy: 'Elaine Porter',
        answeredAt: isoDaysAgo(24),
      },
    ],
  },
  {
    id: makeDemoId('session-helix'),
    name: 'Helix Foods - Order-to-Cash Friction',
    templateId: makeDemoId('template-operating-model'),
    status: 'completed',
    ownerId: owner('owner-owen', 'Owen Park', 'owen.park@consultify.demo').id,
    startedAt: isoDaysAgo(21),
    completedAt: isoDaysAgo(20),
    lastActivityAt: isoDaysAgo(20),
    projectId: 'demo-project-food',
    companyProfile: {
      name: 'Helix Foods',
      industry: 'Food Manufacturing',
      size: '1001-5000',
      location: 'Leeds, UK',
      employees: 2100,
      revenue: '$620M',
    },
    summary: {
      facts: [
        'Credit release and pricing exception handling are the two largest order delays.',
        'Plants report service KPIs weekly but root-cause data is not standardized.',
        'Finance estimates 2.4 FTE are consumed by avoidable rework each month.',
      ],
      gaps: [
        'No common definition of what counts as order ready.',
        'Escalation path for repeat exceptions is informal.',
      ],
      constraints: ['ERP customization is frozen through the current quarter.'],
      painPoints: [
        'Customer service manually consolidates data from ERP, email, and plant trackers.',
      ],
    },
    notes: [
      {
        id: makeDemoId('note-helix-1'),
        category: 'finance',
        title: 'Cost of rework',
        content:
          'Controller shared a directional estimate only. A cleaner baseline will require tagged exception data over 6 weeks.',
        createdAt: isoDaysAgo(20),
        updatedAt: isoDaysAgo(20),
        createdBy: 'Owen Park',
      },
    ],
    evidence: [
      {
        id: makeDemoId('evidence-helix-1'),
        questionIndex: 0,
        category: 'operations',
        evidenceType: 'file',
        title: 'O2C exception log',
        name: 'helix-o2c-exception-log.xlsx',
        fileSize: 142000,
        fileType: 'application/vnd.ms-excel',
        mimeType: 'application/vnd.ms-excel',
        uploadedBy: 'Owen Park',
        uploadedAt: isoDaysAgo(20),
      },
    ],
    answers: [
      {
        answerText:
          'Orders loop back when pricing exceptions need manual approval or when stock allocation changes after planning.',
        status: 'answered',
        confidenceScore: 5,
        tags: ['risk'],
        answeredBy: 'Owen Park',
        answeredAt: isoDaysAgo(20),
      },
      {
        answerText:
          'Throughput is measured by order cycle time, quality by first-time-right orders, and service reliability by requested-vs-confirmed ship date.',
        status: 'answered',
        confidenceScore: 5,
        tags: ['priority'],
        answeredBy: 'Owen Park',
        answeredAt: isoDaysAgo(20),
      },
      {
        answerText:
          'Local planners rely on personal checklists because exception resolution steps are not fully documented in the standard operating procedure.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['constraint'],
        answeredBy: 'Owen Park',
        answeredAt: isoDaysAgo(20),
      },
      {
        answerText:
          'Finance estimates around $320k annualized cost from order corrections, credits, and additional customer service touchpoints.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['priority'],
        answeredBy: 'Owen Park',
        answeredAt: isoDaysAgo(20),
      },
      {
        answerText:
          'ERP is the system of record, but teams also re-enter information into a pricing spreadsheet and a plant scheduling tracker.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['risk', 'opportunity'],
        answeredBy: 'Owen Park',
        answeredAt: isoDaysAgo(20),
      },
      {
        answerText:
          'A 20 percent reduction in exception handling time would be enough for the COO to sponsor a formal improvement sprint.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['priority', 'opportunity'],
        answeredBy: 'Owen Park',
        answeredAt: isoDaysAgo(20),
      },
    ],
  },
  {
    id: makeDemoId('session-meridian'),
    name: 'Meridian Health - Data Readiness',
    templateId: makeDemoId('template-data-analytics'),
    status: 'archived',
    ownerId: owner('owner-lena', 'Lena Meyer', 'lena.meyer@consultify.demo').id,
    startedAt: isoDaysAgo(18),
    completedAt: isoDaysAgo(17),
    lastActivityAt: isoDaysAgo(16),
    projectId: 'demo-project-health',
    companyProfile: {
      name: 'Meridian Health Group',
      industry: 'Healthcare Services',
      size: '5000+',
      location: 'Berlin, Germany',
      employees: 6400,
      revenue: '$1.2B',
    },
    summary: {
      facts: [
        'Executives trust financial reporting but not operational demand forecasting.',
        'Manual spreadsheet adjustments happen before every monthly review pack.',
        'Data ownership exists at domain level but issue triage is still slow.',
      ],
      gaps: ['No shared definition for referral conversion across clinics.'],
      constraints: ['Legacy scheduling platform exports data overnight only.'],
      painPoints: ['Analysts spend more time reconciling definitions than producing insight.'],
    },
    notes: [
      {
        id: makeDemoId('note-meridian-1'),
        category: 'digital',
        title: 'Trust issue',
        content:
          'The COO said the team waits for the analyst to “clean” the numbers before discussing action.',
        createdAt: isoDaysAgo(17),
        updatedAt: isoDaysAgo(17),
        createdBy: 'Lena Meyer',
      },
    ],
    evidence: [
      {
        id: makeDemoId('evidence-meridian-1'),
        questionIndex: 1,
        category: 'digital',
        evidenceType: 'comment',
        name: 'Reporting note',
        description:
          'Referral data requires manual adjustment before it can be used in performance reviews.',
        uploadedBy: 'Lena Meyer',
        uploadedAt: isoDaysAgo(17),
      },
    ],
    answers: [
      {
        answerText:
          'Operational planning, staffing, and clinic referral routing would improve fastest if data were trusted end to end.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['opportunity'],
        answeredBy: 'Lena Meyer',
        answeredAt: isoDaysAgo(17),
      },
      {
        answerText:
          'Referral conversion is the most contested source because booking logic varies by clinic and some teams adjust figures locally.',
        status: 'answered',
        confidenceScore: 5,
        tags: ['risk'],
        answeredBy: 'Lena Meyer',
        answeredAt: isoDaysAgo(17),
      },
      {
        answerText:
          'Department heads export data to spreadsheets before every monthly review to reconcile exceptions and annotate context.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['constraint'],
        answeredBy: 'Lena Meyer',
        answeredAt: isoDaysAgo(17),
      },
      {
        answerText:
          'Simple reporting changes take around 10 business days because analysts need to align on definitions before they build.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['constraint'],
        answeredBy: 'Lena Meyer',
        answeredAt: isoDaysAgo(17),
      },
      {
        answerText:
          'Domain owners exist for finance, patient operations, and workforce planning, but escalation is still analyst-led.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['priority'],
        answeredBy: 'Lena Meyer',
        answeredAt: isoDaysAgo(17),
      },
      {
        answerText:
          'Value is discussed in terms of staffing accuracy and referral conversion, but there is no single analytics benefits baseline.',
        status: 'answered',
        confidenceScore: 3,
        tags: ['gap'],
        answeredBy: 'Lena Meyer',
        answeredAt: isoDaysAgo(17),
      },
    ],
  },
  {
    id: makeDemoId('session-aurora'),
    name: 'Aurora Retail - Onboarding Acceleration',
    templateId: makeDemoId('template-onboarding'),
    status: 'completed',
    ownerId: owner('owner-sienna', 'Sienna Brooks', 'sienna.brooks@consultify.demo').id,
    startedAt: isoDaysAgo(14),
    completedAt: isoDaysAgo(13),
    lastActivityAt: isoDaysAgo(13),
    projectId: 'demo-project-retail',
    companyProfile: {
      name: 'Aurora Retail Media',
      industry: 'Retail Technology',
      size: '201-500',
      location: 'Toronto, Canada',
      employees: 320,
      revenue: '$72M',
    },
    summary: {
      facts: [
        'The onboarding clock is measured differently by sales, implementation, and customer success.',
        'Customers often resend requirements because intake details are incomplete at contract handoff.',
        'Revenue recognition is delayed when data integration tasks slip beyond week two.',
      ],
      gaps: ['No consistent handoff checklist between sales and implementation.'],
      constraints: [
        'Implementation tooling does not expose customer task completion in one shared view.',
      ],
      painPoints: [
        'Customer success teams spend time chasing information already shared during pre-sales.',
      ],
    },
    notes: [
      {
        id: makeDemoId('note-aurora-1'),
        category: 'people',
        title: 'Cross-functional ownership',
        content:
          'Sales thinks the contract signature is the finish line. Delivery thinks it is the real starting point.',
        createdAt: isoDaysAgo(13),
        updatedAt: isoDaysAgo(13),
        createdBy: 'Sienna Brooks',
      },
    ],
    evidence: [
      {
        id: makeDemoId('evidence-aurora-1'),
        questionIndex: 2,
        category: 'digital',
        evidenceType: 'link',
        title: 'Onboarding flow screenshot',
        name: 'Aurora onboarding tracker',
        url: 'https://example.com/aurora-onboarding',
        description: 'Illustrates manual tasks that sit outside the main workflow board.',
        uploadedBy: 'Sienna Brooks',
        uploadedAt: isoDaysAgo(13),
      },
    ],
    answers: [
      {
        answerText:
          'Sales starts the clock at signature, implementation at kickoff, and customer success at first activation milestone.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['risk'],
        answeredBy: 'Sienna Brooks',
        answeredAt: isoDaysAgo(13),
      },
      {
        answerText:
          'Data mapping and scope clarification create the most confusion between sales and delivery.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['priority'],
        answeredBy: 'Sienna Brooks',
        answeredAt: isoDaysAgo(13),
      },
      {
        answerText:
          'Customer-specific tasks still live in email and shared docs instead of the onboarding board.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['constraint'],
        answeredBy: 'Sienna Brooks',
        answeredAt: isoDaysAgo(13),
      },
      {
        answerText:
          'A two-week slip can delay roughly $180k in activation-based revenue recognition for a mid-size client cohort.',
        status: 'answered',
        confidenceScore: 3,
        tags: ['priority'],
        answeredBy: 'Sienna Brooks',
        answeredAt: isoDaysAgo(13),
      },
      {
        answerText:
          'The strongest promise is a confident first 30 days with visible early wins and no repeated data requests.',
        status: 'answered',
        confidenceScore: 5,
        tags: ['opportunity'],
        answeredBy: 'Sienna Brooks',
        answeredAt: isoDaysAgo(13),
      },
      {
        answerText:
          'Customers repeatedly clarify access rights, data field mapping, and success owner contacts.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['risk'],
        answeredBy: 'Sienna Brooks',
        answeredAt: isoDaysAgo(13),
      },
    ],
  },
  {
    id: makeDemoId('session-polaris'),
    name: 'Polaris Services - AI Copilot Rollout',
    templateId: makeDemoId('template-ai-copilot'),
    status: 'active',
    ownerId: 'CURRENT_USER',
    startedAt: isoDaysAgo(5),
    lastActivityAt: isoDaysAgo(1),
    projectId: 'demo-project-ai',
    assignmentId: makeDemoId('assignment-my-polaris'),
    companyProfile: {
      name: 'Polaris Services',
      industry: 'Business Services',
      size: '201-500',
      location: 'New York, USA',
      employees: 430,
      revenue: '$96M',
    },
    summary: {
      facts: [
        'The sales operations team is the leading candidate for a first AI copilot use case.',
        'Teams want stronger prompt guidance before they trust AI-generated drafts.',
      ],
      gaps: ['No agreed quality control checklist yet.'],
      constraints: ['Policy review must approve any customer-facing usage.'],
      painPoints: ['Managers are unsure how to separate time saved from work shifted.'],
    },
    notes: [
      {
        id: makeDemoId('note-polaris-1'),
        category: 'people',
        title: 'Adoption risk',
        content:
          'Team leads want examples of “good enough” AI outputs before pushing broader usage.',
        createdAt: isoDaysAgo(2),
        updatedAt: isoDaysAgo(1),
        createdBy: 'Current user',
      },
    ],
    evidence: [
      {
        id: makeDemoId('evidence-polaris-1'),
        questionIndex: 2,
        category: 'people',
        evidenceType: 'comment',
        name: 'Workshop note',
        description:
          'Managers said trust grows when AI suggestions stay within a known process and review checklist.',
        uploadedBy: 'Current user',
        uploadedAt: isoDaysAgo(1),
      },
    ],
    linkedItems: [
      {
        id: makeDemoId('initiative-polaris-1'),
        type: 'initiative',
        title: 'Copilot pilot for sales operations',
        status: 'Discovery',
        edgeId: makeDemoId('edge-polaris-1'),
      },
    ],
    answers: [
      {
        answerText:
          'Leadership wants faster proposal drafting and cleaner meeting follow-ups without increasing QA risk.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['opportunity'],
        answeredAt: isoDaysAgo(4),
      },
      {
        answerText:
          'Sales operations is the clearest first use case because the team processes repetitive requests with consistent structure.',
        status: 'answered',
        confidenceScore: 5,
        tags: ['priority'],
        answeredAt: isoDaysAgo(3),
      },
      {
        answerText:
          'The strongest concern is that teams will trust drafts too quickly without a clear review checklist.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['risk'],
        answeredAt: isoDaysAgo(2),
      },
      {
        answerText:
          'The pilot plans to measure cycle time saved, first-pass quality, and adoption frequency by manager.',
        status: 'in_progress',
        confidenceScore: 3,
        tags: ['priority'],
      },
      {
        answerText: '',
        status: 'not_started',
        confidenceScore: 0,
        tags: [],
      },
      {
        answerText:
          'Data retention policy and customer-approved knowledge sources need to be signed off before rollout.',
        status: 'needs_follow_up',
        confidenceScore: 2,
        tags: ['constraint'],
      },
    ],
  },
  {
    id: makeDemoId('session-atlas'),
    name: 'Atlas B2B - Revenue Operations Review',
    templateId: makeDemoId('template-stakeholder-sprint'),
    status: 'completed',
    ownerId: 'CURRENT_USER',
    startedAt: isoDaysAgo(9),
    completedAt: isoDaysAgo(7),
    lastActivityAt: isoDaysAgo(7),
    projectId: 'demo-project-revops',
    assignmentId: makeDemoId('assignment-my-atlas'),
    companyProfile: {
      name: 'Atlas B2B Systems',
      industry: 'Industrial Distribution',
      size: '501-1000',
      location: 'Warsaw, Poland',
      employees: 610,
      revenue: '$210M',
    },
    summary: {
      facts: [
        'Commercial leaders agree pipeline hygiene is a problem but disagree on where accountability sits.',
        'Weekly reporting focuses on volume, not conversion friction or decision cycle time.',
      ],
      gaps: ['No shared view of stalled-deal reasons by segment.'],
      constraints: ['CRM governance is light and field usage varies by region.'],
      painPoints: [
        'The sponsor wants a recommendation quickly but evidence is still thin on pipeline quality.',
      ],
    },
    notes: [
      {
        id: makeDemoId('note-atlas-1'),
        category: 'strategy',
        title: 'Sponsor expectation',
        content: 'The CRO wants a 90-day action plan immediately after discovery.',
        createdAt: isoDaysAgo(8),
        updatedAt: isoDaysAgo(7),
        createdBy: 'Current user',
      },
      {
        id: makeDemoId('note-atlas-2'),
        category: 'people',
        title: 'Field concern',
        content:
          'Regional sales managers support the review, but account executives are sensitive to anything that feels like extra CRM admin.',
        createdAt: isoDaysAgo(7),
        updatedAt: isoDaysAgo(7),
        createdBy: 'Current user',
      },
    ],
    evidence: [
      {
        id: makeDemoId('evidence-atlas-1'),
        questionIndex: 0,
        category: 'strategy',
        evidenceType: 'link',
        title: 'SteerCo notes',
        name: 'Atlas steerco notes',
        url: 'https://example.com/atlas-steerco',
        description: 'Sponsor notes captured during steering committee.',
        uploadedBy: 'Current user',
        uploadedAt: isoDaysAgo(7),
      },
      {
        id: makeDemoId('evidence-atlas-2'),
        questionIndex: 2,
        category: 'operations',
        evidenceType: 'file',
        title: 'Pipeline friction snapshot',
        name: 'atlas-pipeline-friction-summary.pdf',
        fileSize: 186000,
        fileType: 'application/pdf',
        mimeType: 'application/pdf',
        description:
          'Working summary of stalled deals, exception causes, and current reporting gaps.',
        uploadedBy: 'Current user',
        uploadedAt: isoDaysAgo(7),
      },
      {
        id: makeDemoId('evidence-atlas-3'),
        questionIndex: 3,
        category: 'digital',
        evidenceType: 'comment',
        title: 'Weekly dashboard concept',
        name: 'Dashboard concept note',
        description:
          'Sales leadership wants one weekly view that combines stalled deals, pricing exceptions, and forecast confidence by region.',
        uploadedBy: 'Current user',
        uploadedAt: isoDaysAgo(7),
      },
      {
        id: makeDemoId('evidence-atlas-4'),
        questionIndex: 5,
        category: 'people',
        evidenceType: 'link',
        title: 'Sponsor communication preference',
        name: 'Atlas sponsor comms note',
        url: 'https://example.com/atlas-sponsor-comms',
        description: 'Internal note on how the CRO expects updates before steering calls.',
        uploadedBy: 'Current user',
        uploadedAt: isoDaysAgo(7),
      },
    ],
    answers: [
      {
        answerText:
          'Success means clearer funnel decisions, clearer accountability between sales management and operations, and a faster route from issue to action. The CRO wants the team to spend less time debating pipeline hygiene and more time making concrete deal and pricing decisions.',
        status: 'answered',
        confidenceScore: 5,
        notes:
          'Sponsor language matters here: he repeatedly described success as “fewer pipeline arguments and faster commercial action.”',
        tags: ['priority', 'opportunity'],
        answeredAt: isoDaysAgo(8),
      },
      {
        answerText:
          'Sales managers and regional leads broadly support the initiative because they want better forecast visibility, but account executives worry that the review could turn into extra CRM admin. Support is strongest where leaders already feel the current funnel reviews are noisy and inconsistent.',
        status: 'answered',
        confidenceScore: 4,
        notes:
          'Main tension: managers want discipline, frontline sellers want lighter process. Framing must focus on better decisions, not more reporting.',
        tags: ['risk', 'people'],
        answeredAt: isoDaysAgo(8),
      },
      {
        answerText:
          'The team lacks a reliable fact base on why deals stall after proposal, so most conversations rely on anecdotes from regional leaders. The biggest evidence gap is a shared segmentation of stalled-deal reasons, especially pricing exceptions, approval delays, and unclear next-owner responsibility.',
        status: 'answered',
        confidenceScore: 5,
        notes:
          'This is the strongest gap in the whole interview. Everyone agrees friction exists, but the organization cannot yet describe it in one common language.',
        tags: ['risk', 'constraint'],
        answeredAt: isoDaysAgo(7),
      },
      {
        answerText:
          'The team wants one weekly management view that combines stalled deals, forecast confidence, pricing exception volume, and ownership of the next action. Leaders do not need more charts; they need one operating view that clearly shows where intervention is required by region and segment.',
        status: 'answered',
        confidenceScore: 5,
        notes:
          'Preferred format is a short manager dashboard with 3-5 clear intervention cues, not a large BI pack.',
        tags: ['opportunity', 'priority'],
        answeredAt: isoDaysAgo(7),
      },
      {
        answerText:
          'The value case is expected to come from better conversion on qualified deals, faster pricing decisions, and better use of management time in weekly reviews. The CRO believes even a modest improvement in deal progression would justify a 90-day revops sprint if the evidence is credible.',
        status: 'answered',
        confidenceScore: 4,
        notes:
          'Need a stronger baseline for current conversion leakage before this can be turned into a quantified case.',
        tags: ['priority', 'opportunity'],
        answeredAt: isoDaysAgo(7),
      },
      {
        answerText:
          'The CRO prefers concise written updates before calls, with a very small number of options and a clear recommendation. He responds best to concrete escalation paths, specific owner names, and short summaries that connect pipeline friction to commercial impact.',
        status: 'answered',
        confidenceScore: 4,
        notes:
          'Best communication style: brief pre-read, one-page summary, then decision-oriented discussion in the meeting itself.',
        tags: ['people', 'priority'],
        answeredAt: isoDaysAgo(7),
      },
    ],
  },
  {
    id: makeDemoId('session-brightwave'),
    name: 'BrightWave Field Ops - Productivity Pulse',
    templateId: makeDemoId('template-frontline-productivity'),
    status: 'active',
    ownerId: 'CURRENT_USER',
    startedAt: isoDaysAgo(6),
    lastActivityAt: isoDaysAgo(2),
    projectId: 'demo-project-field',
    assignmentId: makeDemoId('assignment-my-brightwave'),
    companyProfile: {
      name: 'BrightWave Field Operations',
      industry: 'Utilities Services',
      size: '1001-5000',
      location: 'Manchester, UK',
      employees: 1800,
      revenue: '$340M',
    },
    summary: {
      facts: [
        'Dispatch changes and unclear materials availability are the biggest daily disruptions.',
      ],
      gaps: ['Need clearer evidence on team-level absence drivers.'],
      constraints: ['The workforce scheduling system is not integrated with local issue logs.'],
      painPoints: ['Supervisors spend a lot of time re-prioritizing work after late changes.'],
    },
    notes: [
      {
        id: makeDemoId('note-brightwave-1'),
        category: 'operations',
        title: 'Send-back note',
        content:
          'Manager asked for stronger examples on how interruptions affect overtime and re-planning.',
        createdAt: isoDaysAgo(2),
        updatedAt: isoDaysAgo(2),
        createdBy: 'Current user',
      },
    ],
    evidence: [
      {
        id: makeDemoId('evidence-brightwave-1'),
        questionIndex: 1,
        category: 'operations',
        evidenceType: 'comment',
        name: 'Supervisor quote',
        description:
          '“The day goes off plan after the second priority change because the crew loses confidence in what matters.”',
        uploadedBy: 'Current user',
        uploadedAt: isoDaysAgo(2),
      },
    ],
    answers: [
      {
        answerText:
          'The day becomes unpredictable when schedule changes arrive after crews are already in transit.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['risk'],
        answeredAt: isoDaysAgo(5),
      },
      {
        answerText:
          'Priority changes, missing materials, and incomplete job packets create the most avoidable rework.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['constraint'],
        answeredAt: isoDaysAgo(5),
      },
      {
        answerText: '',
        status: 'needs_follow_up',
        confidenceScore: 2,
        notes: 'Need concrete examples from two field supervisors.',
        tags: ['gap'],
      },
      {
        answerText: 'Coaching on exception handling would help supervisors reset the day faster.',
        status: 'answered',
        confidenceScore: 3,
        tags: ['people'],
        answeredAt: isoDaysAgo(4),
      },
      {
        answerText: '',
        status: 'not_started',
        confidenceScore: 0,
        tags: [],
      },
      {
        answerText:
          'Leaders would notice a meaningful improvement if overtime and repeat visits both dropped in the same month.',
        status: 'in_progress',
        confidenceScore: 3,
        tags: ['priority'],
      },
    ],
  },
  {
    id: makeDemoId('session-cedar'),
    name: 'Cedar Finance - Working Capital Diagnostic',
    templateId: makeDemoId('template-working-capital'),
    status: 'completed',
    ownerId: owner('owner-sarah', 'Sarah Kim', 'sarah.kim@consultify.demo').id,
    startedAt: isoDaysAgo(11),
    completedAt: isoDaysAgo(10),
    lastActivityAt: isoDaysAgo(9),
    projectId: 'demo-project-finance',
    assignmentId: makeDemoId('assignment-managed-cedar'),
    companyProfile: {
      name: 'Cedar Industrial Finance',
      industry: 'Industrial Manufacturing',
      size: '1001-5000',
      location: 'Stuttgart, Germany',
      employees: 2300,
      revenue: '$540M',
    },
    summary: {
      facts: [
        'Receivables reviews focus on aging buckets but not on root cause by account type.',
        'Inventory exceptions are discussed locally before finance sees the impact.',
      ],
      gaps: ['No leading indicator for overdue billing risk.'],
      constraints: ['Cross-functional ownership is weak between finance and supply chain.'],
      painPoints: ['Teams debate numbers instead of focusing on specific release actions.'],
    },
    notes: [
      {
        id: makeDemoId('note-cedar-1'),
        category: 'finance',
        title: 'Reviewer-ready pack',
        content: 'Good first draft. Stronger examples on inventory policy waivers would help.',
        createdAt: isoDaysAgo(9),
        updatedAt: isoDaysAgo(9),
        createdBy: 'Sarah Kim',
      },
    ],
    evidence: [
      {
        id: makeDemoId('evidence-cedar-1'),
        questionIndex: 0,
        category: 'finance',
        evidenceType: 'file',
        title: 'Weekly working capital pack',
        name: 'cedar-working-capital-pack.pdf',
        fileSize: 220000,
        fileType: 'application/pdf',
        mimeType: 'application/pdf',
        uploadedBy: 'Sarah Kim',
        uploadedAt: isoDaysAgo(9),
      },
    ],
    answers: [
      {
        answerText:
          'Cash conversion cycle gets the most attention, especially DSO variance by region.',
        status: 'answered',
        confidenceScore: 5,
        tags: ['priority'],
        answeredBy: 'Sarah Kim',
        answeredAt: isoDaysAgo(10),
      },
      {
        answerText:
          'Late billing after shipment confirmation and excess safety stock are the main operational drivers.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['risk'],
        answeredBy: 'Sarah Kim',
        answeredAt: isoDaysAgo(10),
      },
      {
        answerText:
          'Ownership blurs between commercial teams, shared service billing, and plant scheduling.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['constraint'],
        answeredBy: 'Sarah Kim',
        answeredAt: isoDaysAgo(10),
      },
      {
        answerText:
          'A weekly exception alert by account and material family would allow much earlier intervention.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['opportunity'],
        answeredBy: 'Sarah Kim',
        answeredAt: isoDaysAgo(10),
      },
      {
        answerText:
          'Releasing $8M to $10M of cash would materially change investment flexibility for the year.',
        status: 'answered',
        confidenceScore: 3,
        tags: ['priority'],
        answeredBy: 'Sarah Kim',
        answeredAt: isoDaysAgo(10),
      },
      {
        answerText:
          'Teams repeatedly waive rush-order and stock-hold policies without a disciplined review loop.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['risk'],
        answeredBy: 'Sarah Kim',
        answeredAt: isoDaysAgo(10),
      },
    ],
  },
  {
    id: makeDemoId('session-quartz'),
    name: 'Quartz Warehousing - Transformation Pulse',
    templateId: makeDemoId('template-transformation-pulse'),
    status: 'active',
    ownerId: owner('owner-daniel', 'Daniel Ortiz', 'daniel.ortiz@consultify.demo').id,
    startedAt: isoDaysAgo(8),
    lastActivityAt: isoDaysAgo(3),
    projectId: 'demo-project-warehouse',
    assignmentId: makeDemoId('assignment-managed-quartz'),
    companyProfile: {
      name: 'Quartz Warehousing',
      industry: 'Supply Chain Services',
      size: '501-1000',
      location: 'Rotterdam, Netherlands',
      employees: 920,
      revenue: '$150M',
    },
    summary: {
      facts: [
        'The automation workstream has momentum, but reporting quality lags behind delivery progress.',
      ],
      gaps: ['Benefits evidence is not consistent across sites.'],
      constraints: ['Program manager is covering two workstreams temporarily.'],
      painPoints: [
        'Escalations arrive late because local issues are reworded before they hit the steering forum.',
      ],
    },
    notes: [
      {
        id: makeDemoId('note-quartz-1'),
        category: 'operations',
        title: 'Overdue review',
        content:
          'The assignee has not yet closed the open evidence gap on site-level benefits tracking.',
        createdAt: isoDaysAgo(3),
        updatedAt: isoDaysAgo(3),
        createdBy: 'Daniel Ortiz',
      },
    ],
    evidence: [
      {
        id: makeDemoId('evidence-quartz-1'),
        questionIndex: 4,
        category: 'finance',
        evidenceType: 'comment',
        name: 'Benefits note',
        description:
          'Site managers can describe savings ideas, but proof is not yet linked to a consistent baseline.',
        uploadedBy: 'Daniel Ortiz',
        uploadedAt: isoDaysAgo(3),
      },
    ],
    answers: [
      {
        answerText:
          'Warehouse automation is visibly on track and receives the strongest sponsor support.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['opportunity'],
        answeredBy: 'Daniel Ortiz',
        answeredAt: isoDaysAgo(7),
      },
      {
        answerText:
          'Alignment is weaker in site reporting because local leaders still describe progress in different ways.',
        status: 'answered',
        confidenceScore: 3,
        tags: ['risk'],
        answeredBy: 'Daniel Ortiz',
        answeredAt: isoDaysAgo(7),
      },
      {
        answerText: 'Site rollout readiness is the workstream most likely to slip this month.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['priority'],
        answeredBy: 'Daniel Ortiz',
        answeredAt: isoDaysAgo(6),
      },
      {
        answerText: '',
        status: 'needs_follow_up',
        confidenceScore: 2,
        tags: ['constraint'],
        notes: 'Need explicit reporting example from north site.',
      },
      {
        answerText: '',
        status: 'in_progress',
        confidenceScore: 2,
        tags: ['gap'],
      },
      {
        answerText:
          'More direct site-level escalation from the sponsor would improve pace immediately.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['people'],
        answeredBy: 'Daniel Ortiz',
        answeredAt: isoDaysAgo(6),
      },
    ],
  },
  {
    id: makeDemoId('session-lumen'),
    name: 'Lumen Retail - Cost Optimization',
    templateId: makeDemoId('template-cost-optimization'),
    status: 'completed',
    ownerId: owner('owner-mia', 'Mia Novak', 'mia.novak@consultify.demo').id,
    startedAt: isoDaysAgo(15),
    completedAt: isoDaysAgo(14),
    lastActivityAt: isoDaysAgo(14),
    projectId: 'demo-project-cost',
    assignmentId: makeDemoId('assignment-managed-lumen'),
    companyProfile: {
      name: 'Lumen Retail',
      industry: 'Retail',
      size: '1001-5000',
      location: 'Prague, Czech Republic',
      employees: 2700,
      revenue: '$480M',
    },
    summary: {
      facts: [
        'Store reporting and campaign coordination create significant central workload.',
        'Vendor tooling overlap is visible across commercial and design teams.',
      ],
      gaps: ['Savings validation still depends on one finance analyst.'],
      constraints: ['Store managers are resistant to reducing local reporting flexibility.'],
      painPoints: ['Teams do not share a single view of low-value coordination work.'],
    },
    notes: [],
    evidence: [],
    answers: [
      {
        answerText:
          'Reporting support, temporary labour coverage, and campaign operations are the biggest moving cost pools.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['priority'],
        answeredBy: 'Mia Novak',
        answeredAt: isoDaysAgo(14),
      },
      {
        answerText:
          'Teams spend time consolidating store asks and manually preparing recurring campaign packs.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['opportunity'],
        answeredBy: 'Mia Novak',
        answeredAt: isoDaysAgo(14),
      },
      {
        answerText:
          'Three workflow and planning tools overlap in capability and are inconsistently used.',
        status: 'answered',
        confidenceScore: 3,
        tags: ['risk'],
        answeredBy: 'Mia Novak',
        answeredAt: isoDaysAgo(14),
      },
      {
        answerText:
          'Campaign operations and local reporting both feel duplicative, especially at region and HQ level.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['people'],
        answeredBy: 'Mia Novak',
        answeredAt: isoDaysAgo(14),
      },
      {
        answerText:
          'A 6 to 8 percent cost improvement feels realistic if service quality and campaign pace are preserved.',
        status: 'answered',
        confidenceScore: 3,
        tags: ['priority'],
        answeredBy: 'Mia Novak',
        answeredAt: isoDaysAgo(14),
      },
      {
        answerText:
          'Savings are validated after the fact and require significant manual explanation today.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['constraint'],
        answeredBy: 'Mia Novak',
        answeredAt: isoDaysAgo(14),
      },
    ],
  },
  {
    id: makeDemoId('session-orchid'),
    name: 'Orchid Telecom - Service Model Review',
    templateId: makeDemoId('template-operating-model'),
    status: 'completed',
    ownerId: owner('owner-julia', 'Julia Hansen', 'julia.hansen@consultify.demo').id,
    startedAt: isoDaysAgo(19),
    completedAt: isoDaysAgo(18),
    lastActivityAt: isoDaysAgo(18),
    projectId: 'demo-project-telecom',
    companyProfile: {
      name: 'Orchid Telecom',
      industry: 'Telecommunications',
      size: '1001-5000',
      location: 'Copenhagen, Denmark',
      employees: 3200,
      revenue: '$710M',
    },
    summary: {
      facts: [
        'Service provisioning delays mostly appear at exception handoffs between sales support and delivery.',
        'There is a clear appetite for a common KPI set and one escalation route.',
      ],
      gaps: ['No agreed metric for first-time-right provisioning.'],
      constraints: ['Legacy workflow tooling limits automated routing.'],
      painPoints: [
        'Operations managers still reconcile service issues manually before the weekly review.',
      ],
    },
    notes: [
      {
        id: makeDemoId('note-orchid-1'),
        category: 'operations',
        title: 'Manager observation',
        content: 'The biggest frustration is repeated clarification on non-standard orders.',
        createdAt: isoDaysAgo(18),
        updatedAt: isoDaysAgo(18),
        createdBy: 'Julia Hansen',
      },
    ],
    evidence: [],
    answers: [
      {
        answerText:
          'Provisioning loops back most often on pricing exceptions and custom install requirements.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['risk'],
        answeredBy: 'Julia Hansen',
        answeredAt: isoDaysAgo(18),
      },
      {
        answerText:
          'Cycle time, first-time-right, and on-time activation are the three service metrics leaders watch.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['priority'],
        answeredBy: 'Julia Hansen',
        answeredAt: isoDaysAgo(18),
      },
      {
        answerText:
          'Teams use local notes for unusual orders because the documented workflow is too generic.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['constraint'],
        answeredBy: 'Julia Hansen',
        answeredAt: isoDaysAgo(18),
      },
      {
        answerText:
          'The service team estimates a meaningful cost from technician reschedules and repeated customer updates.',
        status: 'answered',
        confidenceScore: 3,
        tags: ['priority'],
        answeredBy: 'Julia Hansen',
        answeredAt: isoDaysAgo(18),
      },
      {
        answerText:
          'The CRM and service workflow board both require manual updates in exception cases.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['risk'],
        answeredBy: 'Julia Hansen',
        answeredAt: isoDaysAgo(18),
      },
      {
        answerText:
          'A 15 percent reduction in avoidable provisioning delays would be enough to trigger a focused improvement sprint.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['opportunity'],
        answeredBy: 'Julia Hansen',
        answeredAt: isoDaysAgo(18),
      },
    ],
  },
  {
    id: makeDemoId('session-sable'),
    name: 'Sable Energy - Stakeholder Alignment Sprint',
    templateId: makeDemoId('template-stakeholder-sprint'),
    status: 'completed',
    ownerId: owner('owner-marcus', 'Marcus Bell', 'marcus.bell@consultify.demo').id,
    startedAt: isoDaysAgo(16),
    completedAt: isoDaysAgo(15),
    lastActivityAt: isoDaysAgo(15),
    projectId: 'demo-project-energy',
    companyProfile: {
      name: 'Sable Energy Services',
      industry: 'Energy Services',
      size: '501-1000',
      location: 'Houston, USA',
      employees: 860,
      revenue: '$260M',
    },
    summary: {
      facts: [
        'The sponsor is highly engaged, but regional leaders want clearer proof before changing the operating rhythm.',
        'Decision bottlenecks are visible around prioritization and resource trade-offs.',
      ],
      gaps: ['Need a cleaner view of cross-region decision dependencies.'],
      constraints: ['Field teams have limited time for additional reporting.'],
      painPoints: [
        'Regional leaders feel that HQ decisions arrive without enough implementation context.',
      ],
    },
    notes: [],
    evidence: [],
    answers: [
      {
        answerText:
          'Success means faster decision cycles and clearer trade-off visibility between regional priorities.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['priority'],
        answeredBy: 'Marcus Bell',
        answeredAt: isoDaysAgo(15),
      },
      {
        answerText:
          'Regional leaders are supportive but cautious, while field managers worry about extra coordination overhead.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['risk'],
        answeredBy: 'Marcus Bell',
        answeredAt: isoDaysAgo(15),
      },
      {
        answerText:
          'Teams need stronger evidence on where decisions are currently delayed and why.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['gap'],
        answeredBy: 'Marcus Bell',
        answeredAt: isoDaysAgo(15),
      },
      {
        answerText:
          'A weekly steering view of decisions, dependencies, and resource conflicts would help most.',
        status: 'answered',
        confidenceScore: 5,
        tags: ['opportunity'],
        answeredBy: 'Marcus Bell',
        answeredAt: isoDaysAgo(15),
      },
      {
        answerText:
          'The strongest value case comes from faster site-level execution and fewer priority reversals.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['priority'],
        answeredBy: 'Marcus Bell',
        answeredAt: isoDaysAgo(15),
      },
      {
        answerText:
          'The sponsor prefers direct written updates with a small number of clear options.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['people'],
        answeredBy: 'Marcus Bell',
        answeredAt: isoDaysAgo(15),
      },
    ],
  },
  {
    id: makeDemoId('session-orbit'),
    name: 'Orbit Media - AI Adoption Review',
    templateId: makeDemoId('template-ai-copilot'),
    status: 'active',
    ownerId: owner('owner-rachel', 'Rachel Ong', 'rachel.ong@consultify.demo').id,
    startedAt: isoDaysAgo(4),
    lastActivityAt: isoDaysAgo(1),
    projectId: 'demo-project-orbit',
    assignmentId: makeDemoId('assignment-managed-orbit'),
    companyProfile: {
      name: 'Orbit Media Group',
      industry: 'Media Services',
      size: '201-500',
      location: 'Singapore',
      employees: 280,
      revenue: '$88M',
    },
    summary: {
      facts: [
        'The use case is promising, but the draft still lacks a credible quality-control model.',
      ],
      gaps: ['No strong example yet for measuring manager-side time saved.'],
      constraints: ['Policy and knowledge-source constraints are only partially documented.'],
      painPoints: [
        'The current submission is directionally right but still too vague for approval.',
      ],
    },
    notes: [
      {
        id: makeDemoId('note-orbit-1'),
        category: 'people',
        title: 'Needs stronger evidence',
        content:
          'The workflow is understandable, but two answers still read like hypotheses rather than evidence-backed statements.',
        createdAt: isoDaysAgo(1),
        updatedAt: isoDaysAgo(1),
        createdBy: 'Rachel Ong',
      },
    ],
    evidence: [
      {
        id: makeDemoId('evidence-orbit-1'),
        questionIndex: 2,
        category: 'people',
        evidenceType: 'comment',
        name: 'Pilot workshop comment',
        description:
          'Managers want a visible review checklist before they allow AI-generated drafts into client-facing work.',
        uploadedBy: 'Rachel Ong',
        uploadedAt: isoDaysAgo(1),
      },
    ],
    answers: [
      {
        answerText:
          'Leadership expects faster proposal preparation and more consistent follow-up summaries.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['opportunity'],
        answeredBy: 'Rachel Ong',
        answeredAt: isoDaysAgo(3),
      },
      {
        answerText:
          'Campaign operations looks like the best first use case because requests are high-volume and repetitive.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['priority'],
        answeredBy: 'Rachel Ong',
        answeredAt: isoDaysAgo(3),
      },
      {
        answerText: 'People are worried about draft quality and over-reliance on AI output.',
        status: 'answered',
        confidenceScore: 3,
        tags: ['risk'],
        answeredBy: 'Rachel Ong',
        answeredAt: isoDaysAgo(2),
      },
      {
        answerText: '',
        status: 'needs_follow_up',
        confidenceScore: 2,
        notes: 'Need a measurable pilot KPI set, not only general ambition.',
        tags: ['gap'],
      },
      {
        answerText: '',
        status: 'not_started',
        confidenceScore: 0,
        tags: [],
      },
      {
        answerText:
          'The policy team still needs a tighter definition of approved knowledge sources.',
        status: 'answered',
        confidenceScore: 3,
        tags: ['constraint'],
        answeredBy: 'Rachel Ong',
        answeredAt: isoDaysAgo(1),
      },
    ],
  },
  {
    id: makeDemoId('session-fjord'),
    name: 'Fjord Commerce - Onboarding Quality Review',
    templateId: makeDemoId('template-onboarding'),
    status: 'active',
    ownerId: owner('owner-nina', 'Nina Petrov', 'nina.petrov@consultify.demo').id,
    startedAt: isoDaysAgo(7),
    lastActivityAt: isoDaysAgo(1),
    projectId: 'demo-project-fjord',
    assignmentId: makeDemoId('assignment-managed-fjord'),
    companyProfile: {
      name: 'Fjord Commerce',
      industry: 'Commerce Technology',
      size: '201-500',
      location: 'Stockholm, Sweden',
      employees: 360,
      revenue: '$102M',
    },
    summary: {
      facts: ['The handoff issue is clear, but evidence quality is uneven across teams.'],
      gaps: ['The submission still lacks a concrete revenue-delay example from finance.'],
      constraints: ['Customer task visibility is split across two tools.'],
      painPoints: [
        'The assignee answered quickly, but not all examples are specific enough for review.',
      ],
    },
    notes: [],
    evidence: [
      {
        id: makeDemoId('evidence-fjord-1'),
        questionIndex: 1,
        category: 'people',
        evidenceType: 'link',
        title: 'Handoff checklist draft',
        name: 'Fjord handoff checklist',
        url: 'https://example.com/fjord-handoff',
        description: 'Early version of the proposed sales-to-delivery handoff checklist.',
        uploadedBy: 'Nina Petrov',
        uploadedAt: isoDaysAgo(1),
      },
    ],
    answers: [
      {
        answerText:
          'Different teams use different start points for onboarding, which hides the real elapsed time.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['risk'],
        answeredBy: 'Nina Petrov',
        answeredAt: isoDaysAgo(6),
      },
      {
        answerText: 'Scope clarification and data readiness are the weakest points in the handoff.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['priority'],
        answeredBy: 'Nina Petrov',
        answeredAt: isoDaysAgo(6),
      },
      {
        answerText: 'Several onboarding tasks are tracked in email instead of the core board.',
        status: 'answered',
        confidenceScore: 3,
        tags: ['constraint'],
        answeredBy: 'Nina Petrov',
        answeredAt: isoDaysAgo(5),
      },
      {
        answerText: '',
        status: 'needs_follow_up',
        confidenceScore: 2,
        notes: 'Need a quantified example of delayed revenue recognition.',
        tags: ['gap'],
      },
      {
        answerText: 'Clients value a confident first 30 days with no repeated data requests.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['opportunity'],
        answeredBy: 'Nina Petrov',
        answeredAt: isoDaysAgo(5),
      },
      {
        answerText: '',
        status: 'not_started',
        confidenceScore: 0,
        tags: [],
      },
    ],
  },
  {
    id: makeDemoId('session-maple'),
    name: 'Maple Diagnostics - Data Governance Review',
    templateId: makeDemoId('template-data-analytics'),
    status: 'active',
    ownerId: owner('owner-aaron', 'Aaron Cole', 'aaron.cole@consultify.demo').id,
    startedAt: isoDaysAgo(6),
    lastActivityAt: isoDaysAgo(2),
    projectId: 'demo-project-maple',
    assignmentId: makeDemoId('assignment-managed-maple'),
    companyProfile: {
      name: 'Maple Diagnostics',
      industry: 'Diagnostics',
      size: '501-1000',
      location: 'Dublin, Ireland',
      employees: 720,
      revenue: '$190M',
    },
    summary: {
      facts: [
        'The team knows which metrics are contested, but the current draft is still incomplete.',
      ],
      gaps: ['Definitions and ownership are only partially captured.'],
      constraints: ['Reporting requests are queued behind other analytics work.'],
      painPoints: ['The assignee has started the work, but the review pack is not yet ready.'],
    },
    notes: [],
    evidence: [],
    answers: [
      {
        answerText:
          'Demand planning and route allocation would improve first if operational data quality were trusted.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['opportunity'],
        answeredBy: 'Aaron Cole',
        answeredAt: isoDaysAgo(5),
      },
      {
        answerText:
          'Specimen routing data is the most contested source because local teams correct it outside the system.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['risk'],
        answeredBy: 'Aaron Cole',
        answeredAt: isoDaysAgo(5),
      },
      {
        answerText: '',
        status: 'in_progress',
        confidenceScore: 2,
        tags: ['constraint'],
      },
      {
        answerText: '',
        status: 'not_started',
        confidenceScore: 0,
        tags: [],
      },
      {
        answerText:
          'Domain ownership exists informally, but there is no visible issue-triage cadence.',
        status: 'answered',
        confidenceScore: 3,
        tags: ['gap'],
        answeredBy: 'Aaron Cole',
        answeredAt: isoDaysAgo(4),
      },
      {
        answerText: '',
        status: 'not_started',
        confidenceScore: 0,
        tags: [],
      },
    ],
  },
];

const INSIGHT_BLUEPRINTS: DemoInsightBlueprint[] = [
  {
    id: makeDemoId('insight-northstar-summary'),
    title: 'Executive Summary - NorthStar Digital Readiness',
    promptType: 'summary',
    status: 'completed',
    confidence: 'High',
    createdAt: isoDaysAgo(23),
    updatedAt: isoDaysAgo(23),
    sourceSessionIds: [makeDemoId('session-northstar')],
    executiveSummary:
      'NorthStar has sponsorship and funding for digital change, but delivery speed and portfolio governance remain fragmented.',
    content: [
      '# NorthStar Digital Readiness',
      '',
      'NorthStar shows clear appetite for digital acceleration, but execution still relies on slow approvals, uneven operating ownership, and inconsistent benefits tracking. The core question is not whether the company wants change, but whether it can govern a digital portfolio as one system instead of a series of disconnected projects.',
      '',
      '> "We have good projects, but not yet a good portfolio story."',
      '',
      '## Key Findings',
      '- Customer-facing exception handling remains the most visible digital friction point and is the clearest candidate for a first redesign use case.',
      '- Release governance is serial across product, data, security, and branch operations, which stretches delivery lead time to roughly 11 weeks.',
      '- Branch-level priorities still compete with portfolio sequencing, so local urgency often outruns enterprise value logic.',
      '- Digital investment is funded, but the post-launch benefits narrative is still inconsistent and hard to compare across initiatives.',
      '',
      '## Themes',
      '- The organization has ambition, sponsorship, and funding, but it lacks one integrated operating rhythm for digital delivery.',
      '- Teams repeatedly create side reconciliations when the core workflow does not expose accountability clearly enough.',
      '- Decision quality is constrained less by strategy than by weak cross-functional orchestration.',
      '',
      '## Issues & Risks',
      '- Leaders lack one consistent narrative for value, sequencing, and trade-offs across the digital roadmap.',
      '- Benefits may continue to be overstated or defended locally unless one portfolio scorecard is introduced.',
      '- Dependency on the transport management platform and data warehouse creates a bottleneck risk for high-value changes.',
      '- Branch teams continue to escalate around the workflow, which hides the true cost of exception handling.',
      '',
      '## Hidden Signals',
      '- The strongest hidden signal is that local teams compensate for governance gaps by creating manual workarounds rather than escalating a structural design issue.',
      '- Another signal is that leadership language already points toward portfolio discipline, but the management system has not caught up to that expectation.',
      '- There is a visible tension between speed for branch issues and consistency for enterprise prioritization.',
      '',
      '## Opportunities',
      '- Create one release governance path across product, data, and operations so that approvals move in parallel rather than serially.',
      '- Define a portfolio-level benefits scorecard for digital initiatives with a small set of common metrics.',
      '- Prioritize exception handling as the first customer-facing redesign area to create a visible operational win.',
      '- Turn branch-level friction into a shared backlog taxonomy instead of allowing local escalation routes to stay informal.',
      '',
      '## Recommended Actions',
      '1. Launch a short governance redesign sprint focused on release sequencing and approval ownership.',
      '2. Stand up one monthly portfolio review using shared benefit and delivery metrics.',
      '3. Use exception handling as the first “proof” case to show how digital delivery can improve both customer experience and internal coordination.',
      '',
      '## Executive Implication',
      'NorthStar is not missing vision. It is missing the operating spine that turns digital ambition into comparable, governable, enterprise-level outcomes.',
    ].join('\n'),
    themes: [
      {
        title: 'Execution speed',
        description:
          'The strongest signal is not lack of ideas but the slow path from decision to release. The delivery system adds time through serial approvals rather than parallel coordination.',
        evidence_refs: [
          makeDemoId('northstar-evidence-release-lead-time'),
          makeDemoId('northstar-evidence-governance'),
        ],
        strength: 'strong',
      },
      {
        title: 'Portfolio coherence',
        description:
          'NorthStar has active digital investments, but leaders still cannot compare initiatives against one shared value and sequencing logic.',
        evidence_refs: [
          makeDemoId('northstar-evidence-value-narrative'),
          makeDemoId('northstar-evidence-funding-model'),
        ],
        strength: 'strong',
      },
      {
        title: 'Operational workaround culture',
        description:
          'Teams close gaps with side spreadsheets and local escalation habits whenever the formal workflow does not expose clear ownership.',
        evidence_refs: [
          makeDemoId('northstar-evidence-customer-friction'),
          makeDemoId('northstar-evidence-manual-reconciliation'),
        ],
        strength: 'moderate',
      },
    ],
    issues: [
      {
        title: 'Portfolio ambiguity',
        description:
          'Leaders lack one consistent narrative for value and sequencing, which makes the roadmap feel funded but not fully governable.',
        severity: 'high',
        evidence_refs: [
          makeDemoId('northstar-evidence-value-narrative'),
          makeDemoId('northstar-evidence-funding-model'),
        ],
      },
      {
        title: 'Serial release governance',
        description:
          'Product, data, security, and branch approvals still move one after another, which stretches delivery lead time and slows learning.',
        severity: 'high',
        evidence_refs: [
          makeDemoId('northstar-evidence-release-lead-time'),
          makeDemoId('northstar-evidence-governance'),
        ],
      },
      {
        title: 'Benefits credibility risk',
        description:
          'Without a common scorecard, post-launch benefits are likely to be described differently by each initiative owner.',
        severity: 'medium',
        evidence_refs: [
          makeDemoId('northstar-evidence-funding-model'),
          makeDemoId('northstar-evidence-value-narrative'),
        ],
      },
      {
        title: 'Workflow bypasses hide true friction',
        description:
          'Local escalations and manual reconciliation mean the formal system underreports how much exception-handling effort the business is absorbing.',
        severity: 'medium',
        evidence_refs: [
          makeDemoId('northstar-evidence-customer-friction'),
          makeDemoId('northstar-evidence-manual-reconciliation'),
        ],
      },
    ],
    opportunities: [
      {
        title: 'Exception handling redesign',
        description:
          'A targeted redesign would improve customer experience, reduce manual coordination, and create a highly visible first win for the digital roadmap.',
        impact: 'high',
        evidence_refs: [
          makeDemoId('northstar-evidence-customer-friction'),
          makeDemoId('northstar-evidence-manual-reconciliation'),
        ],
      },
      {
        title: 'Portfolio review reset',
        description:
          'A simple shared scorecard would allow leaders to compare initiatives using one language for value, pace, and dependency risk.',
        impact: 'high',
        evidence_refs: [
          makeDemoId('northstar-evidence-value-narrative'),
          makeDemoId('northstar-evidence-funding-model'),
        ],
      },
      {
        title: 'Parallel approval model',
        description:
          'Redesigning governance to run approvals in parallel could materially cut lead time without changing strategic direction.',
        impact: 'medium',
        evidence_refs: [
          makeDemoId('northstar-evidence-release-lead-time'),
          makeDemoId('northstar-evidence-governance'),
        ],
      },
    ],
    signals: [
      {
        title: 'Ambition exceeds operating discipline',
        description:
          'Leadership language signals strong ambition, but the management system still behaves like a collection of local projects rather than one portfolio.',
        type: 'tension',
      },
      {
        title: 'Governance gap is being absorbed locally',
        description:
          'Instead of escalating structural workflow issues, teams compensate through spreadsheets and local coordination habits.',
        type: 'emerging_pattern',
      },
      {
        title: 'Customer pain is already concentrated',
        description:
          'Exception handling stands out as the clearest concentrated friction point, which makes it a strong candidate for a first transformation proof point.',
        type: 'gap',
      },
      {
        title: 'Value narrative and delivery narrative are drifting apart',
        description:
          'The roadmap is easy to defend in principle, but much harder to compare and govern using shared post-launch evidence.',
        type: 'contradiction',
      },
    ],
    evidenceMap: [
      {
        answer_id: makeDemoId('northstar-evidence-value-narrative'),
        question_text:
          'What outcomes does leadership expect from the digital roadmap over the next 12 months?',
        answer_snippet:
          'Leadership expects faster exception resolution, more self-service on customer issues, and one portfolio narrative for digital investment decisions.',
        linked_themes: ['Portfolio coherence'],
        linked_issues: ['Portfolio ambiguity', 'Benefits credibility risk'],
      },
      {
        answer_id: makeDemoId('northstar-evidence-customer-friction'),
        question_text:
          'Which customer journeys are most critical today, and where does digital friction appear?',
        answer_snippet:
          'Shipment tracking works well, but claims, delayed delivery updates, and appointment changes still require phone calls or email escalation.',
        linked_themes: ['Operational workaround culture'],
        linked_issues: ['Workflow bypasses hide true friction'],
      },
      {
        answer_id: makeDemoId('northstar-evidence-release-lead-time'),
        question_text:
          'How long does it currently take to move a digital idea from request to release?',
        answer_snippet:
          'Average lead time is about 11 weeks. Security review, data validation, and branch sign-off happen one after another rather than in parallel.',
        linked_themes: ['Execution speed'],
        linked_issues: ['Serial release governance'],
      },
      {
        answer_id: makeDemoId('northstar-evidence-governance'),
        question_text: 'Which teams own product decisions, delivery, and adoption?',
        answer_snippet:
          'Product owns priorities, IT delivery owns release execution, and operations owns adoption by branch. Escalation sits with the COO sponsor.',
        linked_themes: ['Execution speed'],
        linked_issues: ['Serial release governance'],
      },
      {
        answer_id: makeDemoId('northstar-evidence-funding-model'),
        question_text: 'How is digital investment prioritized and tracked today?',
        answer_snippet:
          'Funding is approved quarterly with light benefits review. There is no consistent portfolio scorecard after launch.',
        linked_themes: ['Portfolio coherence'],
        linked_issues: ['Portfolio ambiguity', 'Benefits credibility risk'],
      },
      {
        answer_id: makeDemoId('northstar-evidence-manual-reconciliation'),
        question_text: 'What platforms or data assets create the biggest dependency risks?',
        answer_snippet:
          'The transport management system and customer data warehouse are the biggest dependencies because both require specialist support to change.',
        linked_themes: ['Operational workaround culture'],
        linked_issues: ['Workflow bypasses hide true friction'],
      },
    ],
    missingData: ['Adoption baseline by branch', 'Portfolio-level benefits scorecard'],
    comments: [
      {
        id: makeDemoId('comment-northstar-1'),
        authorName: 'Piotr Wisniewski',
        content:
          'Good summary. For the demo, keep the narrative tight: governance first, then scorecard, then exception handling as the visible use case.',
        createdAt: isoDaysAgo(22),
        priority: 'normal',
      },
      {
        id: makeDemoId('comment-northstar-2'),
        authorName: 'Elaine Porter',
        content:
          'The “portfolio ambiguity” card is exactly right. That is the point executives react to fastest in workshops.',
        createdAt: isoDaysAgo(22),
        priority: 'high',
      },
      {
        id: makeDemoId('comment-northstar-3'),
        authorName: 'Marta Gomez',
        content:
          'It is also worth showing that customer exception handling is not only a CX issue but a coordination cost issue across teams.',
        createdAt: isoDaysAgo(21),
        priority: 'normal',
      },
      {
        id: makeDemoId('comment-northstar-4'),
        authorName: 'Piotr Wisniewski',
        content:
          'This is a strong showcase artifact because every section tells the same story from a different angle.',
        createdAt: isoDaysAgo(21),
        priority: 'low',
      },
    ],
    activity: [
      {
        id: makeDemoId('activity-northstar-1'),
        type: 'created',
        description: 'Insight generated from the NorthStar session.',
        timestamp: isoDaysAgo(23),
        userName: 'Consultify AI',
      },
      {
        id: makeDemoId('activity-northstar-2'),
        type: 'edit',
        description: 'Insight title and executive framing were refined for workshop playback.',
        timestamp: isoDaysAgo(22),
        userName: 'Piotr Wisniewski',
        oldValue: 'NorthStar Digital Readiness',
        newValue: 'Executive Summary - NorthStar Digital Readiness',
      },
      {
        id: makeDemoId('activity-northstar-3'),
        type: 'comment',
        description: 'A comment was added to refine the output for showcase use.',
        timestamp: isoDaysAgo(22),
        userName: 'Piotr Wisniewski',
      },
      {
        id: makeDemoId('activity-northstar-4'),
        type: 'comment',
        description: 'Client-side reviewer highlighted the portfolio ambiguity angle.',
        timestamp: isoDaysAgo(22),
        userName: 'Elaine Porter',
      },
      {
        id: makeDemoId('activity-northstar-5'),
        type: 'exported',
        description: 'Insight exported to Tools for follow-up action design.',
        timestamp: isoDaysAgo(21),
        userName: 'Piotr Wisniewski',
      },
      {
        id: makeDemoId('activity-northstar-6'),
        type: 'regenerated',
        description:
          'Insight regenerated after adding stronger evidence references and opportunity framing.',
        timestamp: isoDaysAgo(21),
        userName: 'Consultify AI',
      },
    ],
  },
  {
    id: makeDemoId('insight-helix-problems'),
    title: 'Problem Discovery - Helix Order-to-Cash',
    promptType: 'problems',
    status: 'completed',
    confidence: 'High',
    createdAt: isoDaysAgo(19),
    updatedAt: isoDaysAgo(19),
    sourceSessionIds: [makeDemoId('session-helix')],
    executiveSummary:
      'The biggest Helix issues are exception-driven rework, unclear ownership, and fragmented supporting data.',
    content: buildInsightMarkdown(
      'Helix Order-to-Cash Problems',
      'Helix is losing efficiency in a narrow set of recurring exception points that are visible but not yet structurally managed.',
      [
        'Pricing and credit exceptions cause frequent order loops.',
        'Teams rely on manual trackers to bridge ERP gaps.',
        'Quality and throughput data exist, but root-cause discipline is still weak.',
      ],
      [
        'Cycle-time improvement may stall if exception ownership stays informal.',
        'ERP freeze could delay the technical portion of the solution.',
      ],
      [
        'Define a common exception taxonomy and owner matrix.',
        'Measure first-time-right orders by exception type.',
        'Separate process changes from ERP changes so progress can start now.',
      ],
      'We know the pain points, but we still solve them one case at a time.'
    ),
    exportedToTools: true,
    comments: [],
    activity: [
      {
        id: makeDemoId('activity-helix-1'),
        type: 'create',
        description: 'Problem discovery insight generated.',
        timestamp: isoDaysAgo(19),
        userName: 'Consultify AI',
      },
      {
        id: makeDemoId('activity-helix-2'),
        type: 'export',
        description: 'Insight exported to Tools.',
        timestamp: isoDaysAgo(18),
        userName: 'Piotr Wisniewski',
      },
    ],
  },
  {
    id: makeDemoId('insight-cross-session-trends'),
    title: 'Trend Analysis - Cross-session Signals',
    promptType: 'trends',
    status: 'completed',
    confidence: 'Medium',
    createdAt: isoDaysAgo(12),
    updatedAt: isoDaysAgo(11),
    sourceSessionIds: [
      makeDemoId('session-northstar'),
      makeDemoId('session-helix'),
      makeDemoId('session-meridian'),
      makeDemoId('session-aurora'),
    ],
    executiveSummary:
      'Across discovery sessions, the repeated theme is not lack of ambition, but weak operating clarity at handoffs and decision points.',
    content: buildInsightMarkdown(
      'Cross-session Trend Analysis',
      'Multiple interviews point to the same structural pattern: organizations know where value should come from, but execution slows where ownership, definitions, or workflow visibility break down.',
      [
        'Handoffs between functions are the most frequent source of delay.',
        'Managers continue to use side tools when the core workflow does not reflect operational reality.',
        'Benefits evidence is often weaker than the transformation narrative.',
      ],
      [
        'Change efforts may remain local unless leaders define a consistent operating model.',
        'Teams will keep debating metrics unless definitions are standardized earlier.',
      ],
      [
        'Use one manager story: handoffs, ownership, and evidence quality.',
        'Target one high-friction process per domain instead of broad redesign.',
        'Add an “evidence quality” lens to executive reviews.',
      ]
    ),
    exportedToAssessment: true,
    activity: [
      {
        id: makeDemoId('activity-trends-1'),
        type: 'create',
        description: 'Trend insight generated from four completed sessions.',
        timestamp: isoDaysAgo(12),
        userName: 'Consultify AI',
      },
      {
        id: makeDemoId('activity-trends-2'),
        type: 'export',
        description: 'Insight exported to Assessment.',
        timestamp: isoDaysAgo(11),
        userName: 'Piotr Wisniewski',
      },
    ],
  },
  {
    id: makeDemoId('insight-aurora-opportunities'),
    title: 'Opportunity Scan - Aurora Onboarding',
    promptType: 'opportunity_scan',
    status: 'completed',
    confidence: 'High',
    createdAt: isoDaysAgo(12),
    updatedAt: isoDaysAgo(12),
    sourceSessionIds: [makeDemoId('session-aurora')],
    executiveSummary:
      'Aurora can unlock faster activation by redesigning handoffs and giving every team one shared onboarding clock.',
    content: buildInsightMarkdown(
      'Aurora Onboarding Opportunities',
      'The biggest Aurora opportunity is not a new process layer, but a simpler shared operating rhythm for sales, implementation, and customer success.',
      [
        'A shared onboarding clock would reduce internal debate and improve accountability.',
        'A simple handoff checklist could eliminate repeated customer clarification.',
        'A visible customer task board would create earlier warning signals.',
      ],
      ['If handoff rules remain informal, improvements will depend on individual diligence.'],
      [
        'Standardize onboarding start and finish definitions.',
        'Introduce a contract-to-kickoff handoff checklist.',
        'Expose customer task progress in one operational view.',
      ]
    ),
    activity: [
      {
        id: makeDemoId('activity-aurora-1'),
        type: 'create',
        description: 'Opportunity scan created from the Aurora session.',
        timestamp: isoDaysAgo(12),
        userName: 'Consultify AI',
      },
    ],
  },
  {
    id: makeDemoId('insight-meridian-risk'),
    title: 'Risk Assessment - Meridian Data Governance',
    promptType: 'risk_assessment',
    status: 'completed',
    confidence: 'Medium',
    createdAt: isoDaysAgo(15),
    updatedAt: isoDaysAgo(14),
    sourceSessionIds: [makeDemoId('session-meridian')],
    executiveSummary:
      'Meridian’s primary risk is slow decision-making caused by low trust in operational data definitions.',
    content: [
      '# Meridian Data Governance Risks',
      '',
      'Meridian has data ownership in principle, but decision speed still suffers because trust in operational numbers remains inconsistent. The core risk is not absence of data, but the repeated need to reinterpret it before leaders feel safe acting on it.',
      '',
      '> "The team waits for the analyst to clean the numbers before discussing action."',
      '',
      '## Key Findings',
      '- Referral conversion is contested and manually adjusted across clinics.',
      '- Analytics delivery is slowed by repeated definition alignment before reporting can even begin.',
      '- Operational leaders trust financial reporting far more than operational demand signals.',
      '- Domain ownership exists, but issue triage still depends too heavily on analysts rather than accountable operators.',
      '',
      '## Risk View',
      '- Planning quality may remain uneven if overnight-only exports continue to delay operational visibility.',
      '- Transformation energy may decline if review meetings keep focusing on data validity rather than action.',
      '- Cross-clinic reporting credibility will remain fragile until one shared referral-conversion definition is adopted.',
      '- Leaders may over-rely on “cleaned” monthly packs instead of operationally useful weekly evidence.',
      '',
      '## Themes',
      '- Meridian has the ingredients of good governance, but not yet the operating discipline to resolve contested metrics quickly.',
      '- Data trust breaks down exactly where cross-functional operational decisions should be moving fastest.',
      '- Analysts are acting as interpreters of the business rather than enablers of faster decisions.',
      '',
      '## Signals',
      '- The strongest hidden signal is that the organization already accepts data correction as normal work.',
      '- Another signal is that ownership exists in theory, but accountability still shifts toward the analytics team when pressure rises.',
      '- There is a visible contradiction between confidence in finance data and skepticism toward operational demand data.',
      '',
      '## Recommended Actions',
      '1. Resolve the top contested metric definition first, beginning with referral conversion.',
      '2. Create a visible triage model for operational data issues with response expectations and named owners.',
      '3. Show one before/after management case where trusted data changed a staffing or routing decision.',
      '',
      '## Executive Implication',
      'Unless Meridian turns data governance into an operating decision system, analytics maturity will stay discussable but not decisively useful.',
    ].join('\n'),
    themes: [
      {
        title: 'Trust gap in operational data',
        description:
          'Financial data is trusted, but operational data still requires local adjustment and interpretation before leaders act.',
        evidence_refs: [
          makeDemoId('meridian-evidence-trusted-decisions'),
          makeDemoId('meridian-evidence-contested-source'),
        ],
        strength: 'strong',
      },
      {
        title: 'Analyst dependency',
        description:
          'Analysts are carrying too much interpretive responsibility because the business has not resolved key data definitions and triage expectations.',
        evidence_refs: [
          makeDemoId('meridian-evidence-spreadsheet-adjustments'),
          makeDemoId('meridian-evidence-reporting-turnaround'),
        ],
        strength: 'strong',
      },
      {
        title: 'Ownership without escalation discipline',
        description:
          'Domain ownership exists, but issue escalation is still routed informally and too late for rapid operating decisions.',
        evidence_refs: [
          makeDemoId('meridian-evidence-ownership-model'),
          makeDemoId('meridian-evidence-benefits-baseline'),
        ],
        strength: 'moderate',
      },
    ],
    issues: [
      {
        title: 'Contested operational metric definitions',
        description:
          'Referral conversion remains contested across clinics, making it difficult to trust cross-site comparisons or act on demand signals quickly.',
        severity: 'high',
        evidence_refs: [
          makeDemoId('meridian-evidence-contested-source'),
          makeDemoId('meridian-evidence-trusted-decisions'),
        ],
      },
      {
        title: 'Decision latency caused by analyst mediation',
        description:
          'Leaders wait for analysts to reconcile and explain operational numbers before discussing action, which slows operational response.',
        severity: 'high',
        evidence_refs: [
          makeDemoId('meridian-evidence-spreadsheet-adjustments'),
          makeDemoId('meridian-evidence-reporting-turnaround'),
        ],
      },
      {
        title: 'Weak data issue triage',
        description:
          'Ownership exists at domain level, but issue escalation is still analyst-led rather than handled through a visible operating model.',
        severity: 'medium',
        evidence_refs: [
          makeDemoId('meridian-evidence-ownership-model'),
          makeDemoId('meridian-evidence-benefits-baseline'),
        ],
      },
      {
        title: 'Benefits story is not anchored',
        description:
          'Analytics value is discussed in broad terms, but there is no shared baseline linking better data to measurable operating improvement.',
        severity: 'medium',
        evidence_refs: [
          makeDemoId('meridian-evidence-benefits-baseline'),
          makeDemoId('meridian-evidence-trusted-decisions'),
        ],
      },
    ],
    opportunities: [
      {
        title: 'Metric-definition reset',
        description:
          'Resolving one high-friction metric definition first would create a practical proof point for governance maturity.',
        impact: 'high',
        evidence_refs: [
          makeDemoId('meridian-evidence-contested-source'),
          makeDemoId('meridian-evidence-ownership-model'),
        ],
      },
      {
        title: 'Faster operational decision loops',
        description:
          'A visible triage model and cleaner operational reporting flow could shorten the route from issue detection to leadership action.',
        impact: 'high',
        evidence_refs: [
          makeDemoId('meridian-evidence-spreadsheet-adjustments'),
          makeDemoId('meridian-evidence-reporting-turnaround'),
        ],
      },
      {
        title: 'Analytics value narrative',
        description:
          'Meridian can strengthen support for analytics by tying trusted data directly to staffing, referral routing, and planning decisions.',
        impact: 'medium',
        evidence_refs: [
          makeDemoId('meridian-evidence-trusted-decisions'),
          makeDemoId('meridian-evidence-benefits-baseline'),
        ],
      },
    ],
    signals: [
      {
        title: 'Data correction has become normalized work',
        description:
          'The organization behaves as if manual adjustment is an expected part of reporting, which hides how much trust debt has accumulated.',
        type: 'emerging_pattern',
      },
      {
        title: 'Ownership exists, but confidence does not',
        description:
          'Named domain owners are in place, yet leaders still do not trust the operating numbers enough to move quickly.',
        type: 'contradiction',
      },
      {
        title: 'Operational action is gated by reporting confidence',
        description:
          'The clearest risk is not bad reporting alone, but the fact that action is deferred until someone “cleans” the story.',
        type: 'tension',
      },
      {
        title: 'Referral conversion is the sharpest governance gap',
        description:
          'One contested metric creates outsized friction, making it the best place to demonstrate a governance reset.',
        type: 'gap',
      },
    ],
    evidenceMap: [
      {
        answer_id: makeDemoId('meridian-evidence-trusted-decisions'),
        question_text: 'Which decisions would improve first if data quality were trusted?',
        answer_snippet:
          'Operational planning, staffing, and clinic referral routing would improve fastest if data were trusted end to end.',
        linked_themes: ['Trust gap in operational data'],
        linked_issues: [
          'Contested operational metric definitions',
          'Benefits story is not anchored',
        ],
      },
      {
        answer_id: makeDemoId('meridian-evidence-contested-source'),
        question_text: 'What data source is most contested or manually corrected today?',
        answer_snippet:
          'Referral conversion is the most contested source because booking logic varies by clinic and some teams adjust figures locally.',
        linked_themes: ['Trust gap in operational data'],
        linked_issues: ['Contested operational metric definitions'],
      },
      {
        answer_id: makeDemoId('meridian-evidence-spreadsheet-adjustments'),
        question_text: 'Where do people still export to spreadsheets before taking action?',
        answer_snippet:
          'Department heads export data to spreadsheets before every monthly review to reconcile exceptions and annotate context.',
        linked_themes: ['Analyst dependency'],
        linked_issues: ['Decision latency caused by analyst mediation'],
      },
      {
        answer_id: makeDemoId('meridian-evidence-reporting-turnaround'),
        question_text: 'What is the current turnaround time for a new reporting request?',
        answer_snippet:
          'Simple reporting changes take around 10 business days because analysts need to align on definitions before they build.',
        linked_themes: ['Analyst dependency'],
        linked_issues: ['Decision latency caused by analyst mediation'],
      },
      {
        answer_id: makeDemoId('meridian-evidence-ownership-model'),
        question_text: 'Who owns data definitions and issue triage across functions?',
        answer_snippet:
          'Domain owners exist for finance, patient operations, and workforce planning, but escalation is still analyst-led.',
        linked_themes: ['Ownership without escalation discipline'],
        linked_issues: ['Weak data issue triage'],
      },
      {
        answer_id: makeDemoId('meridian-evidence-benefits-baseline'),
        question_text: 'How is analytics value tracked beyond dashboard usage?',
        answer_snippet:
          'Value is discussed in terms of staffing accuracy and referral conversion, but there is no single analytics benefits baseline.',
        linked_themes: ['Ownership without escalation discipline'],
        linked_issues: ['Benefits story is not anchored', 'Weak data issue triage'],
      },
    ],
    missingData: [
      'Shared definition for referral conversion across clinics',
      'Visible triage SLA for operational data issues',
      'Before/after case showing how trusted data improved a management decision',
    ],
    comments: [
      {
        id: makeDemoId('comment-meridian-1'),
        authorName: 'Marta Gomez',
        content:
          'Would be good to tie this risk back to workforce planning decisions. That makes the governance issue much more concrete for executives.',
        createdAt: isoDaysAgo(14),
        priority: 'high',
      },
      {
        id: makeDemoId('comment-meridian-2'),
        authorName: 'Lena Meyer',
        content:
          'The contradiction between trusted finance data and mistrusted operational demand data feels especially important in workshops.',
        createdAt: isoDaysAgo(14),
        priority: 'normal',
      },
      {
        id: makeDemoId('comment-meridian-3'),
        authorName: 'Piotr Wisniewski',
        content:
          'For demos, the strongest hook is that the organization has ownership on paper but not yet a fast decision system in practice.',
        createdAt: isoDaysAgo(13),
        priority: 'normal',
      },
      {
        id: makeDemoId('comment-meridian-4'),
        authorName: 'Marta Gomez',
        content:
          'The evidence map is strong here because every major risk traces back to one of six recurring answers.',
        createdAt: isoDaysAgo(13),
        priority: 'low',
      },
    ],
    activity: [
      {
        id: makeDemoId('activity-meridian-1'),
        type: 'created',
        description: 'Risk assessment generated.',
        timestamp: isoDaysAgo(15),
        userName: 'Consultify AI',
      },
      {
        id: makeDemoId('activity-meridian-2'),
        type: 'edit',
        description: 'Risk framing was updated to emphasize decision latency and governance debt.',
        timestamp: isoDaysAgo(14),
        userName: 'Piotr Wisniewski',
        oldValue: 'Meridian Data Governance Risks',
        newValue: 'Risk Assessment - Meridian Data Governance',
      },
      {
        id: makeDemoId('activity-meridian-3'),
        type: 'comment',
        description: 'Comment added to improve executive framing.',
        timestamp: isoDaysAgo(14),
        userName: 'Marta Gomez',
      },
      {
        id: makeDemoId('activity-meridian-4'),
        type: 'comment',
        description:
          'Reviewer added a note about linking the risk to workforce planning decisions.',
        timestamp: isoDaysAgo(14),
        userName: 'Lena Meyer',
      },
      {
        id: makeDemoId('activity-meridian-5'),
        type: 'exported',
        description: 'Insight exported to Assessment for governance discussion.',
        timestamp: isoDaysAgo(13),
        userName: 'Piotr Wisniewski',
      },
      {
        id: makeDemoId('activity-meridian-6'),
        type: 'regenerated',
        description:
          'Insight regenerated after adding structured evidence references and hidden signals.',
        timestamp: isoDaysAgo(13),
        userName: 'Consultify AI',
      },
    ],
  },
  {
    id: makeDemoId('insight-stakeholder-map'),
    title: 'Stakeholder Mapping - Atlas Revenue Ops',
    promptType: 'stakeholder_map',
    status: 'completed',
    confidence: 'Medium',
    createdAt: isoDaysAgo(6),
    updatedAt: isoDaysAgo(6),
    sourceSessionIds: [makeDemoId('session-atlas')],
    executiveSummary:
      'Atlas has sponsor support, but frontline commercial stakeholders need a clearer reason to change how they use the CRM.',
    content: buildInsightMarkdown(
      'Atlas Stakeholder Mapping',
      'The key stakeholder dynamic is not resistance to the objective, but skepticism that tighter process will reduce daily friction.',
      [
        'The CRO is supportive and wants rapid action.',
        'Regional sales managers will support clearer forecast visibility.',
        'Account executives are worried about additional admin burden.',
      ],
      ['Change could be framed as extra reporting rather than better deal decisions.'],
      [
        'Show how CRM discipline reduces chasing and rework.',
        'Use regional managers as early advocates.',
        'Keep sponsor communication concise and action-focused.',
      ]
    ),
    activity: [
      {
        id: makeDemoId('activity-atlas-1'),
        type: 'create',
        description: 'Stakeholder map generated.',
        timestamp: isoDaysAgo(6),
        userName: 'Consultify AI',
      },
    ],
  },
];

export function createInterviewDemoDataset(context: DemoInterviewContext = {}) {
  const currentUserId = context.currentUserId || 'current-user';
  const currentUserName = context.currentUserName || 'Piotr Wisniewski';
  const currentUserEmail = context.currentUserEmail || 'piotr@consultify.demo';
  const organizationId = context.organizationId || 'demo-org';
  const defaultProjectId = 'demo-project-showcase';

  const templates = TEMPLATE_BLUEPRINTS.map((template) => ({
    id: template.id,
    organizationId,
    name: template.name,
    description: template.description,
    questionCount: template.questions.length,
    category: template.category,
    isDefault: template.isDefault,
    scope: template.scope,
    audience: template.audience,
    estimatedTimeMinutes: template.estimatedTimeMinutes,
    runtimeModeDefault: template.runtimeModeDefault,
    areaTags: template.areaTags,
    status: template.status,
    sessionsUsed: template.sessionsUsed,
    updatedAt: template.updatedAt,
    createdAt: template.createdAt,
  }));

  const templateQuestionsById = Object.fromEntries(
    TEMPLATE_BLUEPRINTS.map((template) => [template.id, buildTemplateQuestions(template)])
  );

  const sessionDetailsById = Object.fromEntries(
    SESSION_BLUEPRINTS.map((sessionBlueprint) => {
      const template = TEMPLATE_BLUEPRINTS.find((item) => item.id === sessionBlueprint.templateId);
      const templateQuestions = template ? buildTemplateQuestions(template) : [];
      const ownerId =
        sessionBlueprint.ownerId === 'CURRENT_USER' ? currentUserId : sessionBlueprint.ownerId;
      const answeredByName =
        sessionBlueprint.ownerId === 'CURRENT_USER'
          ? currentUserName
          : sessionBlueprint.notes[0]?.createdBy || 'Interview owner';
      const questions = templateQuestions.map((templateQuestion, index) => {
        const answer = sessionBlueprint.answers[index] || {};
        return {
          id: makeDemoId(`question-${sessionBlueprint.id}-${index + 1}`),
          sessionId: sessionBlueprint.id,
          category: templateQuestion.category,
          questionText: templateQuestion.questionText,
          answerText: answer.answerText || '',
          isRequired: true,
          answerType: templateQuestion.answerType,
          answerOptions: templateQuestion.answerOptions,
          expectedAnswerShape: templateQuestion.expectedAnswerShape,
          answerMode: 'text',
          answerPayload: null,
          contextNote: answer.contextNote,
          notes: answer.notes,
          description: templateQuestion.description,
          evidencePrompt: templateQuestion.evidencePrompt,
          voiceTranscript: undefined,
          voiceTranscriptStatus: 'none',
          voiceAudioEvidenceId: undefined,
          allowVoice: true,
          allowFileUpload: true,
          allowUrl: true,
          allowContextNote: true,
          status: answer.status || 'not_started',
          confidenceScore: answer.confidenceScore ?? (answer.answerText ? 4 : 0),
          answeredBy: answer.answeredBy || answeredByName,
          answeredAt: answer.answeredAt,
          tags: answer.tags || [],
          sortOrder: index + 1,
          isTemplate: false,
        };
      });

      const answeredQuestions = questions.filter(
        (question) => question.status === 'answered'
      ).length;
      const summaryFacts = sessionBlueprint.summary.facts;
      const summaryGaps = sessionBlueprint.summary.gaps;
      const summaryConstraints = sessionBlueprint.summary.constraints;
      const summaryPainPoints = sessionBlueprint.summary.painPoints;

      const session = {
        id: sessionBlueprint.id,
        organizationId,
        projectId: sessionBlueprint.projectId || defaultProjectId,
        name: sessionBlueprint.name,
        ownerId,
        status: sessionBlueprint.status,
        assignmentId: sessionBlueprint.assignmentId,
        progress: {},
        totalQuestions: questions.length,
        answeredQuestions,
        summaryFacts,
        summaryGaps,
        summaryConstraints,
        summaryPainPoints,
        runtimeModeDefault:
          template?.runtimeModeDefault === 'task_list' ? 'task_list' : 'single_question',
        startedAt: sessionBlueprint.startedAt,
        completedAt: sessionBlueprint.completedAt,
        lastActivityAt: sessionBlueprint.lastActivityAt,
        templateName: template?.name,
      };

      const notes = sessionBlueprint.notes.map((note) => ({
        ...note,
        sessionId: sessionBlueprint.id,
        createdBy:
          note.createdBy === 'Current user' ? currentUserName : note.createdBy || currentUserName,
      }));

      const evidence = sessionBlueprint.evidence.map((item) => ({
        id: item.id,
        sessionId: sessionBlueprint.id,
        questionId:
          typeof item.questionIndex === 'number' ? questions[item.questionIndex]?.id : undefined,
        category: item.category,
        evidenceType: item.evidenceType,
        evidenceRole: item.evidenceRole || 'supporting',
        title: item.title,
        name: item.name,
        url: item.url,
        description: item.description,
        fileSize: item.fileSize,
        fileType: item.fileType,
        mimeType: item.mimeType,
        transcriptText: item.transcriptText,
        uploadedBy:
          item.uploadedBy === 'Current user' ? currentUserName : item.uploadedBy || currentUserName,
        createdAt: item.uploadedAt,
        uploadedAt: item.uploadedAt,
      }));

      const linkedItems = (sessionBlueprint.linkedItems || []).map((linked) => ({
        ...linked,
      }));

      return [
        sessionBlueprint.id,
        {
          session,
          questions,
          notes,
          evidence,
          companyProfile: sessionBlueprint.companyProfile,
          summary: sessionBlueprint.summary,
          linkedItems,
        },
      ];
    })
  );

  const sessions = [
    makeDemoId('session-northstar'),
    makeDemoId('session-helix'),
    makeDemoId('session-meridian'),
    makeDemoId('session-aurora'),
    makeDemoId('session-cedar'),
    makeDemoId('session-lumen'),
    makeDemoId('session-orchid'),
    makeDemoId('session-sable'),
  ]
    .map((id) => sessionDetailsById[id]?.session)
    .filter(Boolean);

  const myAssignmentsBlueprints: DemoAssignmentBlueprint[] = [
    {
      id: makeDemoId('assignment-my-polaris'),
      templateId: makeDemoId('template-ai-copilot'),
      sessionId: makeDemoId('session-polaris'),
      status: 'in_progress',
      priority: 'high',
      dueAt: isoDaysFromNow(3),
      createdAt: isoDaysAgo(5),
      updatedAt: isoDaysAgo(1),
      assignee: owner(currentUserId, currentUserName, currentUserEmail),
    },
    {
      id: makeDemoId('assignment-my-atlas'),
      templateId: makeDemoId('template-stakeholder-sprint'),
      sessionId: makeDemoId('session-atlas'),
      status: 'submitted',
      priority: 'medium',
      dueAt: isoDaysAgo(1),
      createdAt: isoDaysAgo(9),
      updatedAt: isoDaysAgo(7),
      assignee: owner(currentUserId, currentUserName, currentUserEmail),
    },
    {
      id: makeDemoId('assignment-my-brightwave'),
      templateId: makeDemoId('template-frontline-productivity'),
      sessionId: makeDemoId('session-brightwave'),
      status: 'sent_back',
      priority: 'high',
      dueAt: isoDaysFromNow(2),
      createdAt: isoDaysAgo(6),
      updatedAt: isoDaysAgo(2),
      assignee: owner(currentUserId, currentUserName, currentUserEmail),
      sentBackReason:
        'Add a stronger example for schedule volatility and clarify where overtime is being triggered.',
    },
  ];

  const managedAssignmentsBlueprints: DemoAssignmentBlueprint[] = [
    {
      id: makeDemoId('assignment-managed-cedar'),
      templateId: makeDemoId('template-working-capital'),
      sessionId: makeDemoId('session-cedar'),
      status: 'submitted',
      priority: 'urgent',
      dueAt: isoDaysAgo(2),
      createdAt: isoDaysAgo(11),
      updatedAt: isoDaysAgo(9),
      assignee: owner('owner-sarah', 'Sarah Kim', 'sarah.kim@consultify.demo'),
    },
    {
      id: makeDemoId('assignment-managed-quartz'),
      templateId: makeDemoId('template-transformation-pulse'),
      sessionId: makeDemoId('session-quartz'),
      status: 'in_progress',
      priority: 'high',
      dueAt: isoDaysAgo(4),
      createdAt: isoDaysAgo(8),
      updatedAt: isoDaysAgo(3),
      assignee: owner('owner-daniel', 'Daniel Ortiz', 'daniel.ortiz@consultify.demo'),
    },
    {
      id: makeDemoId('assignment-managed-lumen'),
      templateId: makeDemoId('template-cost-optimization'),
      sessionId: makeDemoId('session-lumen'),
      status: 'approved',
      priority: 'medium',
      dueAt: isoDaysAgo(6),
      createdAt: isoDaysAgo(15),
      updatedAt: isoDaysAgo(14),
      assignee: owner('owner-mia', 'Mia Novak', 'mia.novak@consultify.demo'),
    },
    {
      id: makeDemoId('assignment-managed-orbit'),
      templateId: makeDemoId('template-ai-copilot'),
      sessionId: makeDemoId('session-orbit'),
      status: 'submitted',
      priority: 'high',
      dueAt: isoDaysAgo(1),
      createdAt: isoDaysAgo(4),
      updatedAt: isoDaysAgo(1),
      assignee: owner('owner-rachel', 'Rachel Ong', 'rachel.ong@consultify.demo'),
    },
    {
      id: makeDemoId('assignment-managed-fjord'),
      templateId: makeDemoId('template-onboarding'),
      sessionId: makeDemoId('session-fjord'),
      status: 'submitted',
      priority: 'medium',
      dueAt: isoDaysFromNow(1),
      createdAt: isoDaysAgo(7),
      updatedAt: isoDaysAgo(1),
      assignee: owner('owner-nina', 'Nina Petrov', 'nina.petrov@consultify.demo'),
    },
    {
      id: makeDemoId('assignment-managed-maple'),
      templateId: makeDemoId('template-data-analytics'),
      sessionId: makeDemoId('session-maple'),
      status: 'in_progress',
      priority: 'medium',
      dueAt: isoDaysAgo(2),
      createdAt: isoDaysAgo(6),
      updatedAt: isoDaysAgo(2),
      assignee: owner('owner-aaron', 'Aaron Cole', 'aaron.cole@consultify.demo'),
    },
  ];

  const allAssignmentsBlueprints = [...myAssignmentsBlueprints, ...managedAssignmentsBlueprints];

  const makeAssignment = (assignment: DemoAssignmentBlueprint) => {
    const template = templates.find((item) => item.id === assignment.templateId);
    const sessionDetail = sessionDetailsById[assignment.sessionId];
    const session = sessionDetail?.session;
    const completenessPercent = session?.totalQuestions
      ? Math.round(((session?.answeredQuestions || 0) / session.totalQuestions) * 100)
      : 0;

    return {
      id: assignment.id,
      organizationId,
      projectId: session?.projectId || defaultProjectId,
      assigneeUserId: assignment.assignee.id,
      templateId: assignment.templateId,
      templateVersion: 1,
      status: assignment.status,
      sessionId: assignment.sessionId,
      dueAt: assignment.dueAt,
      startedAt: session?.startedAt,
      submittedAt:
        assignment.status === 'submitted' || assignment.status === 'approved'
          ? session?.completedAt || session?.lastActivityAt
          : undefined,
      sentBackAt: assignment.status === 'sent_back' ? assignment.updatedAt : undefined,
      sentBackReason: assignment.sentBackReason,
      priority: assignment.priority,
      isTeamAssignment: false,
      notes: assignment.sentBackReason,
      createdBy: currentUserId,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
      template: template
        ? {
            id: template.id,
            name: template.name,
            description: template.description,
            category: template.category,
          }
        : undefined,
      assignee: assignment.assignee,
      session: session
        ? {
            id: session.id,
            status: session.status,
            answeredQuestions: session.answeredQuestions,
            totalQuestions: session.totalQuestions,
            completenessPercent,
          }
        : undefined,
    };
  };

  const myAssignments = myAssignmentsBlueprints.map(makeAssignment);
  const managedAssignments = managedAssignmentsBlueprints.map(makeAssignment);
  const overdueAssignments = managedAssignments.filter(
    (assignment) =>
      new Date(assignment.dueAt || 0).getTime() < Date.now() && assignment.status !== 'approved'
  );

  const insightDetailsById = Object.fromEntries(
    INSIGHT_BLUEPRINTS.map((insight) => [
      insight.id,
      {
        id: insight.id,
        organizationId,
        title: insight.title,
        promptType: insight.promptType,
        sourceSessionIds: insight.sourceSessionIds,
        filters: {},
        content: insight.content,
        executiveSummary: insight.executiveSummary,
        themes: insight.themes || [],
        issues: insight.issues || [],
        opportunities: insight.opportunities || [],
        signals: insight.signals || [],
        evidenceMap: insight.evidenceMap || [],
        missingData: insight.missingData || [],
        status: insight.status,
        sourceSessionCount: insight.sourceSessionIds.length,
        tokensUsed: 1840,
        generationTimeMs: 4200,
        createdBy: currentUserId,
        createdAt: insight.createdAt,
        updatedAt: insight.updatedAt,
        confidence: insight.confidence,
        exportedToTools: insight.exportedToTools,
        exportedToAssessment: insight.exportedToAssessment,
      },
    ])
  );

  const insights = INSIGHT_BLUEPRINTS.map((insight) => ({
    id: insight.id,
    sessionId: insight.sourceSessionIds[0],
    organizationId,
    title: insight.title,
    content: insight.content,
    description: insight.executiveSummary,
    sourceQuote: insight.content.match(/"([^"]+)"/)?.[1],
    type: insight.promptType,
    category: 'Interview intelligence',
    insightType: insight.promptType,
    promptType: insight.promptType,
    priority: 'high' as const,
    impactLevel: 'High',
    confidence: insight.confidence,
    status: insight.status,
    actionable: true,
    exportedToTools: insight.exportedToTools,
    exportedToAssessment: insight.exportedToAssessment,
    sourceSessionCount: insight.sourceSessionIds.length,
    tokensUsed: 1840,
    generationTimeMs: 4200,
    createdBy: currentUserId,
    createdAt: insight.createdAt,
    updatedAt: insight.updatedAt,
  }));

  const insightCommentsById = Object.fromEntries(
    INSIGHT_BLUEPRINTS.map((insight) => [insight.id, insight.comments || []])
  );

  const insightActivityById = Object.fromEntries(
    INSIGHT_BLUEPRINTS.map((insight) => [insight.id, insight.activity || []])
  );

  const assignmentsBySessionId = Object.fromEntries(
    allAssignmentsBlueprints.map((assignment) => [assignment.sessionId, makeAssignment(assignment)])
  );

  return {
    templates,
    templateQuestionsById,
    sessions,
    sessionDetailsById,
    myAssignments,
    managedAssignments,
    overdueAssignments,
    insights,
    insightDetailsById,
    insightCommentsById,
    insightActivityById,
    assignmentsBySessionId,
  };
}

export type InterviewDemoDataset = ReturnType<typeof createInterviewDemoDataset>;
