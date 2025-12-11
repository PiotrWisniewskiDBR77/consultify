
export enum AppView {
  WELCOME = 'WELCOME',
  AUTH = 'AUTH',
  DASHBOARD = 'DASHBOARD',
  USER_DASHBOARD = 'USER_DASHBOARD',

  // Quick Assessment
  QUICK_STEP1_PROFILE = 'QUICK_STEP1_PROFILE',
  QUICK_STEP2_USER_CONTEXT = 'QUICK_STEP2_USER_CONTEXT',
  QUICK_STEP3_EXPECTATIONS = 'QUICK_STEP3_EXPECTATIONS',

  // Full Transformation Views
  FULL_STEP1_CONTEXT = 'FULL_STEP1_CONTEXT', // NEW: Senior Consultant Context Gathering
  FULL_STEP1_ASSESSMENT = 'FULL_STEP1_ASSESSMENT', // Parent
  FULL_STEP1_PROCESSES = 'FULL_STEP1_PROCESSES',
  FULL_STEP1_DIGITAL = 'FULL_STEP1_DIGITAL',
  FULL_STEP1_MODELS = 'FULL_STEP1_MODELS',
  FULL_STEP1_DATA = 'FULL_STEP1_DATA',
  FULL_STEP1_CULTURE = 'FULL_STEP1_CULTURE',
  FULL_STEP1_CYBERSECURITY = 'FULL_STEP1_CYBERSECURITY',
  FULL_STEP1_AI = 'FULL_STEP1_AI',

  FULL_STEP2_INITIATIVES = 'FULL_STEP2_INITIATIVES',
  FULL_STEP3_ROADMAP = 'FULL_STEP3_ROADMAP',
  FULL_STEP4_ROI = 'FULL_STEP4_ROI',
  FULL_STEP5_EXECUTION = 'FULL_STEP5_EXECUTION', // Keeping for backward compat
  FULL_PILOT_EXECUTION = 'FULL_PILOT_EXECUTION', // Module 4
  FULL_ROLLOUT = 'FULL_ROLLOUT', // Module 5
  FULL_STEP6_REPORTS = 'FULL_STEP6_REPORTS',

  MASTERCLASS = 'MASTERCLASS',
  RESOURCES = 'RESOURCES',

  // Legacy/Fallback
  FREE_ASSESSMENT_CHAT = 'FREE_ASSESSMENT_CHAT',
  FULL_TRANSFORMATION_CHAT = 'FULL_TRANSFORMATION_CHAT',

  // SaaS / Admin
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
  ADMIN_USERS = 'ADMIN_USERS',
  ADMIN_PROJECTS = 'ADMIN_PROJECTS',
  ADMIN_LLM = 'ADMIN_LLM',
  ADMIN_KNOWLEDGE = 'ADMIN_KNOWLEDGE',
  ADMIN_TEAMS = 'ADMIN_TEAMS',
  ADMIN_ANALYTICS = 'ADMIN_ANALYTICS',
  ADMIN_FEEDBACK = 'ADMIN_FEEDBACK',
  ADMIN_BILLING = 'ADMIN_BILLING',
  SETTINGS_PROFILE = 'SETTINGS_PROFILE',
  SETTINGS_BILLING = 'SETTINGS_BILLING',

  // Teamwork Views
  TASKS = 'TASKS',
  TASKS_KANBAN = 'TASKS_KANBAN',
  TASKS_LIST = 'TASKS_LIST',
  TEAMS = 'TEAMS',
  NOTIFICATIONS = 'NOTIFICATIONS'
}

export enum SessionMode {
  FREE = 'FREE',
  FULL = 'FULL'
}

export enum AuthStep {
  LOGIN = 'LOGIN',
  REGISTER = 'REGISTER',
  CODE_ENTRY = 'CODE_ENTRY'
}

export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  USER = 'USER',
  CEO = 'CEO',
  COO = 'COO',
  CFO = 'CFO',
  CIO = 'CIO',
  MANAGER = 'MANAGER',
  OTHER = 'OTHER'
}

export enum AssessmentStep {
  INTRO = 'INTRO',
  ROLE = 'ROLE',
  INDUSTRY = 'INDUSTRY',
  INDUSTRY_SUB = 'INDUSTRY_SUB',
  SIZE = 'SIZE',
  COUNTRY = 'COUNTRY',
  CHALLENGES = 'CHALLENGES',
  GOAL = 'GOAL',
  HORIZON = 'HORIZON',
  SUMMARY = 'SUMMARY',
  COMPLETE = 'COMPLETE',
  PRIORITY = 'PRIORITY',
  DIGITAL_MATURITY = 'DIGITAL_MATURITY',
  REVENUE = 'REVENUE',

  // New Module 1 Steps
  BUSINESS_MODEL = 'BUSINESS_MODEL',
  CORE_PROCESSES = 'CORE_PROCESSES',
  IT_LANDSCAPE = 'IT_LANDSCAPE',
  STRATEGIC_GOALS = 'STRATEGIC_GOALS',
  SUCCESS_CRITERIA = 'SUCCESS_CRITERIA',
  CHALLENGES_MAP = 'CHALLENGES_MAP',
  CONSTRAINTS = 'CONSTRAINTS'
}

export type Language = 'EN' | 'PL' | 'DE' | 'AR';

export interface ChatOption {
  id: string;
  label: string;
  value: string;
}

export interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: Date;
  type?: 'text' | 'action_request' | 'summary' | 'file';
  options?: ChatOption[]; // For interactive buttons
  multiSelect?: boolean;  // If true, allows multiple selections
}

export interface AIMessageHistory {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface StrategicGoal {
  id: string;
  title: string;
  type: 'Efficiency' | 'Growth' | 'Quality' | 'Innovation' | 'Cost' | 'Other';
  horizon: '12m' | '24m' | '36m';
  priority: 'High' | 'Medium' | 'Low';
  description?: string;
}

export interface Challenge {
  id: string;
  title: string;
  area: 'People' | 'Process' | 'Technology' | 'Data';
  severity: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  description?: string;
}

export interface Constraint {
  id: string;
  type: 'Budget' | 'Time' | 'Talent' | 'Legacy Tech' | 'Culture';
  description: string;
  impactLevel: 'High' | 'Medium' | 'Low';
}

export interface CompanyProfile {
  name: string;
  industry: string;
  subIndustry?: string;
  size: string;
  country: string;
  role: string;

  // Module 1 New Fields
  businessModel?: {
    type: string[]; // B2B, B2C, Marketplace, etc.
    description: string;
  };
  coreProcesses?: string[]; // Sales, Production, etc.
  itLandscape?: {
    erp?: string;
    mes?: string;
    wms?: string;
    crm?: string;
    customApps?: string;
    integrationLevel?: 'Low' | 'Medium' | 'High';
  };
}

export interface User {
  id: string; // New: Unique ID
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  companyName: string;
  role?: string; // e.g. CEO, ADMIN
  status: 'active' | 'inactive';
  lastLogin?: string; // ISO date

  isAuthenticated: boolean;
  accessLevel: 'free' | 'full';
  preferredLanguage?: Language;
  organizationId?: string;
  avatarUrl?: string; // URL to avatar image
  tokenUsage?: number;
  tokenLimit?: number;
  industry?: string; // Company industry
  country?: string; // Company country
  impersonatorId?: string; // ID of the admin impersonating this user
}

export interface FreeSession {
  // Step 1
  painPoints: string[];
  goal: string;
  timeHorizon: string;
  step1Completed: boolean;

  // Step 2 (Extended Profile)
  mainPainPoint?: string;
  priorityArea?: string;
  digitalMaturity?: string;
  revenueBracket?: string;
  step2Completed: boolean;

  // Step 3 (Recommendations)
  generatedFocusAreas?: string[];
  generatedQuickWins?: { title: string; desc: string }[];
  step3Completed: boolean;

  // Module 1 Context Fields
  strategicGoals?: StrategicGoal[];
  successCriteria?: string;
  challengesMap?: Challenge[];
  constraints?: Constraint[];

  // Legacy
  selectedIdeas: string[];
}

// --- FULL SESSION TYPES ---

export type AxisId = 'processes' | 'digitalProducts' | 'businessModels' | 'dataManagement' | 'culture' | 'cybersecurity' | 'aiMaturity';

export interface AssessmentAxis {
  score: number;
  answers: number[]; // 1-7 scale values
  areaScores?: { [areaId: string]: number[] }; // Granular scores per area (e.g., "1A": [3, 4])
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
}

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5' | 'Q6' | 'Q7' | 'Q8';
export type Wave = 'Wave 1' | 'Wave 2' | 'Wave 3';
export type InitiativeStatus = 'step3' | 'step4' | 'step5' | 'completed' | 'on_hold' | 'Draft' | 'Ready' | 'To Do' | 'In Progress' | 'Blocked' | 'Done' | 'Archived';
export type TaskType = 'analytical' | 'design' | 'execution' | 'validation';
export type RiskRating = 'low' | 'medium' | 'high' | 'critical';
export type DependencyType = 'hard' | 'soft';

export type CostRange = 'Low (<$10k)' | 'Medium ($10k-$50k)' | 'High (>$50k)';
export type BenefitRange = 'Low (<$20k/yr)' | 'Medium ($20k-$100k/yr)' | 'High (>$100k/yr)';

export interface FullInitiative {
  id: string;
  name: string;
  description?: string;
  axis: AxisId;
  priority: 'High' | 'Medium' | 'Low' | 'Critical';
  complexity: 'High' | 'Medium' | 'Low'; // Keep for compatibility
  status: InitiativeStatus;

  // DRD New Fields
  summary?: string;
  hypothesis?: string;
  businessValue?: 'High' | 'Medium' | 'Low';
  competenciesRequired?: string[];
  milestones?: { name: string; date: string; status: 'pending' | 'completed' }[];

  // Professional Card Fields
  problemStatement?: string;
  deliverables?: string[];
  successCriteria?: string[];
  scopeIn?: string[];
  scopeOut?: string[];
  keyRisks?: { risk: string; mitigation: string; metric: 'Low' | 'Medium' | 'High' }[];
  relatedGap?: string; // Links this initiative to a specific DRD Gap

  // Economics (financial fields for analytics)
  capex?: number;
  firstYearOpex?: number;
  annualBenefit?: number;
  roi?: number;
  costCapex?: number;
  costOpex?: number;
  expectedRoi?: number;
  socialImpact?: string;

  // Legacy Economics (keep or map?)
  estimatedCost?: number;
  estimatedAnnualBenefit?: number;
  costRange?: CostRange;
  benefitRange?: BenefitRange;

  // Timeline
  startDate?: string;
  pilotEndDate?: string;
  endDate?: string;
  quarter?: Quarter;
  wave?: Wave;

  // Governance
  ownerBusinessId?: string;
  ownerExecutionId?: string;
  sponsorId?: string;
  assigneeId?: string; // For risk calculations
  ownerBusiness?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  ownerExecution?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  sponsor?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  marketContext?: string;

  // Execution
  progress?: number;

  createdAt?: string;
  updatedAt?: string;
}

// Alias Initiative to FullInitiative for backend compatibility
export type Initiative = FullInitiative;

export interface EconomicsSummary {
  totalCost: number;
  totalAnnualBenefit: number;
  overallROI: number;
  paybackPeriodYears: number;
}

export interface FullReport {
  executiveSummary: string;
  keyFindings: string[];
  recommendations: string[];
  generatedAt: string;

  // New Fields for Comprehensive Report
  transformationDescription?: string;
  drdLevels?: { axis: string; level: number }[];
  keyInitiatives?: { name: string; status: string; impact: string }[];
  kpiResults?: { kpi: string; value: string; trend: string }[];
  financials?: { cost: number; benefit: number; roi: number; payback: number };
  lessonsLearned?: string[];
  aiRecommendations?: string[];
  roadmapHighlights?: string[];
  cultureAssessment?: string;
}

// --- MODULE 2 TYPES ---

// Align DRDAxis with AxisId
export type DRDAxis = 'processes' | 'digitalProducts' | 'businessModels' | 'dataManagement' | 'culture' | 'cybersecurity' | 'aiMaturity';
export type MaturityLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface AxisAssessment {
  actual: MaturityLevel;
  target: MaturityLevel;
  justification: string;
  notes?: string;
}

export interface AdditionalAudit {
  id: string;
  name: string;
  date: string;
  score: string;
  fileUrl?: string; // or local ref
  aiSummary?: string;
  mappedAxis?: DRDAxis;
}

export interface RoadmapItem {
  id: string;
  initiativeId: string;
  startDate: string;
  endDate: string;
  lane?: string;
}

export interface FullSession {
  id: string;

  // Progress Flags
  step1Completed?: boolean;
  step2Completed?: boolean;
  step3Completed?: boolean;
  step4Completed?: boolean;
  step5Completed?: boolean;

  // Module 1 PRO: Context Sufficiency
  contextSufficiency?: {
    score: number; // 0-100
    gaps: string[];
    isReady: boolean;
    lastAnalysis?: string;
  };

  // Module 2 Assessment Data
  assessment: Partial<Record<DRDAxis, AxisAssessment>> & { completedAxes: AxisId[] };
  audits: AdditionalAudit[];
  gapMapAnalysis?: string; // AI generated summary of gaps

  // Module 3 Data
  initiatives: FullInitiative[];
  roadmap: RoadmapItem[];

  // Module 4 & 5 Data (Placeholders)
  kpiResults?: Record<string, string>;
  economics?: EconomicsSummary;
  report?: FullReport;

  chatHistory?: ChatMessage[];

  // Legacy / Computed
  drdLevels?: Record<string, { current: number; target: number }>;
}

export interface SessionContext {
  mode: SessionMode;
  step: number;
  companyProfile: Partial<CompanyProfile>;
  fullSession?: FullSession;
}

export interface Idea {
  id: string;
  category: 'quickwin' | 'process' | 'ai';
  title: string;
  description: string;
  difficulty: 1 | 2 | 3;
  impactDescription: string;
  area: 'Procesy' | 'Dane' | 'AI / Automatyzacja';
  isSelected: boolean;
}

export interface TimelineItem {
  ideaId: string;
  startMonth: number;
  endMonth: number;
  category: 'quickwin' | 'process' | 'ai';
}

export interface ImplementationPlan {
  timeline: TimelineItem[];
  operationalImpact: {
    process: string;
    data: string;
    ai: string;
  };
  financialImpact: {
    process: string;
    data: string;
    ai: string;
  };
}

export interface KnowledgeDoc {
  id: string;
  filename: string;
  filepath: string;
  status: 'pending' | 'indexing' | 'indexed' | 'error';
  created_at: string;
}

export interface LLMProvider {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'ollama' | 'local' | 'tavily' | 'google_search';
  api_key: string;
  endpoint: string;
  model_id: string;
  cost_per_1k: number;
  input_cost_per_1k?: number;
  output_cost_per_1k?: number;
  markup_multiplier?: number;
  is_active: boolean;
  visibility: 'admin' | 'public' | 'beta';
}

export type AIProviderType = 'system' | 'openai' | 'gemini' | 'ollama';

export interface AIProviderConfig {
  provider: AIProviderType;
  apiKey?: string;
  endpoint?: string; // For Ollama or Custom Proxy
  modelId?: string;
}

// ==========================================
// PHASE 1: TEAMWORK & COLLABORATION TYPES
// ==========================================

// Task Status (Workflow)
// Extended to include legacy aliases used in some components
export type TaskStatus = 'not_started' | 'in_progress' | 'waiting_data' | 'waiting_decision' | 'blocked' | 'completed' | 'rejected' | 'todo' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';
export type TeamRole = 'lead' | 'member';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  organizationId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  assignee?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  reporterId?: string;
  reporter?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  dueDate?: string;
  estimatedHours?: number;
  checklist?: ChecklistItem[];
  attachments?: TaskAttachment[];
  tags?: string[];
  customStatusId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;

  // DRD Fields
  taskType?: TaskType;
  budgetAllocated?: number;
  budgetSpent?: number;
  riskRating?: RiskRating;
  acceptanceCriteria?: string;
  blockingIssues?: string;
  stepPhase?: 'design' | 'pilot' | 'rollout';
  initiativeId?: string;
  why?: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  leadId?: string;
  lead?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  memberCount?: number;
  createdAt: string;
}

export interface TeamMember {
  teamId: string;
  userId: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'avatarUrl'>;
  role: TeamRole;
  joinedAt: string;
}

export interface ProjectUser {
  projectId: string;
  userId: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  role: ProjectRole;
  assignedAt: string;
}

export interface CustomStatus {
  id: string;
  organizationId: string;
  name: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  createdAt: string;
}

// Notification Types
export type NotificationType =
  | 'task_assigned'
  | 'task_completed'
  | 'status_changed'
  | 'deadline'
  | 'mention'
  | 'project_milestone'
  | 'comment'
  | 'team_invite';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  data?: {
    entityType: 'task' | 'project' | 'team' | 'user';
    entityId: string;
    entityName?: string;
    [key: string]: any;
  };
  read: boolean;
  createdAt: string;
}

// Activity Log (Audit Trail)
export type ActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'status_changed'
  | 'assigned'
  | 'unassigned'
  | 'commented'
  | 'completed'
  | 'archived';

export type ActivityEntityType = 'task' | 'project' | 'user' | 'team' | 'organization';

export interface ActivityLog {
  id: string;
  organizationId: string;
  userId?: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId?: string;
  entityName?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// Extended User with aiConfig (remove duplicate by keeping this one)
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  companyName: string;
  role?: string; // SUPERADMIN, ADMIN, USER
  status: 'active' | 'inactive';
  lastLogin?: string;
  isAuthenticated: boolean;
  accessLevel: 'free' | 'full';
  preferredLanguage?: Language;
  organizationId?: string;
  avatarUrl?: string;
  tokenUsage?: number;
  tokenLimit?: number;
  tokenResetAt?: string;
  aiConfig?: AIProviderConfig;
}

// Organization with extended fields
export interface Organization {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'blocked' | 'trial';
  createdAt: string;
  validUntil?: string;
  userCount?: number;
}

// Project with extended fields
export interface Project {
  id: string;
  organizationId: string;
  name: string;
  status: 'active' | 'archived' | 'completed';
  ownerId?: string;
  owner?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  createdAt: string;
  taskCount?: number;
  memberCount?: number;
}

// ==========================================
// PHASE 2: DRD STRATEGY EXECUTION TYPES
// ==========================================





export interface TaskDependency {
  id: string;
  fromTaskId: string;
  toTaskId: string;
  type: DependencyType;
  createdAt: string;
}

// Extended Task Interface
// Note: We are augmenting the existing Task interface. 
// Ideally we keep one definition, so we will update the previous Task interface in place 
// or extend it here. Since I am replacing the end of the file, I will just export 
// the extensions if I can't reach the original definition easily in this chunks.
// However, 'types.ts' is small enough I should probably update the main Task definition earlier in the file 
// OR just add the fields to the interface if I had access to it.
// Wait, I am at the end of the file. The Task definition was around line 341.
// I will just add a note here that Task is extended, but for the code to compile, 
// I should really update the original Task interface. 
// BUT, since I can't edit non-contiguous easily without 'multi_replace', 
// and I am currently in 'replace_file_content' for the END of the file...
// Actually, I can use 'multi_replace_file_content' to update both. 
// For now, let's just add the types here and I will do a separate pass to update the Task interface 
// at line 341 using `multi_replace` or checking if I can do it all now. 
// I will assume I need to update the Task interface in a separate call or use multi_replace.
// Let's use multi_replace instead of this single replace to do it cleanly.

export type FeedbackType = 'bug' | 'feature' | 'general';
export type FeedbackStatus = 'new' | 'read' | 'resolved' | 'rejected';

export interface Feedback {
  id: string;
  userId: string;
  type: FeedbackType;
  message: string;
  screenshot?: string; // Base64
  url?: string;
  status: FeedbackStatus;
  createdAt: string;
  user?: Pick<User, 'firstName' | 'lastName' | 'email'>;
}

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface Invitation {
  id: string;
  organizationId: string;
  email: string;
  role: UserRole;
  token: string;
  status: InvitationStatus;
  invitedBy?: string;
  inviter?: Pick<User, 'firstName' | 'lastName'>;
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string;
}
