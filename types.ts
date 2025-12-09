
export enum AppView {
  WELCOME = 'WELCOME',
  AUTH = 'AUTH',
  DASHBOARD = 'DASHBOARD',

  // Quick Assessment
  QUICK_STEP1_PROFILE = 'QUICK_STEP1_PROFILE',
  QUICK_STEP2_CHALLENGES = 'QUICK_STEP2_CHALLENGES',
  QUICK_STEP3_RECOMMENDATIONS = 'QUICK_STEP3_RECOMMENDATIONS',

  // Full Transformation
  FULL_STEP1_ASSESSMENT = 'FULL_STEP1_ASSESSMENT', // Parent
  FULL_STEP1_PROCESSES = 'FULL_STEP1_PROCESSES',
  FULL_STEP1_DIGITAL = 'FULL_STEP1_DIGITAL',
  FULL_STEP1_MODELS = 'FULL_STEP1_MODELS',
  FULL_STEP1_DATA = 'FULL_STEP1_DATA',
  FULL_STEP1_CULTURE = 'FULL_STEP1_CULTURE',
  FULL_STEP1_AI = 'FULL_STEP1_AI',

  FULL_STEP2_INITIATIVES = 'FULL_STEP2_INITIATIVES',
  FULL_STEP3_ROADMAP = 'FULL_STEP3_ROADMAP',
  FULL_STEP4_ROI = 'FULL_STEP4_ROI',
  FULL_STEP5_EXECUTION = 'FULL_STEP5_EXECUTION',
  FULL_STEP6_REPORTS = 'FULL_STEP6_REPORTS',

  MASTERCLASS = 'MASTERCLASS',
  RESOURCES = 'RESOURCES',

  // Legacy/Fallback
  FREE_ASSESSMENT_CHAT = 'FREE_ASSESSMENT_CHAT',
  FULL_TRANSFORMATION_CHAT = 'FULL_TRANSFORMATION_CHAT',

  // SaaS / Admin
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
  ADMIN_USERS = 'ADMIN_USERS',
  SETTINGS_PROFILE = 'SETTINGS_PROFILE',
  SETTINGS_BILLING = 'SETTINGS_BILLING'
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
  ADMIN = 'ADMIN',
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
  REVENUE = 'REVENUE'
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

export interface CompanyProfile {
  name: string;
  industry: string;
  subIndustry?: string;
  size: string;
  country: string;
  role: string;
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

  // Legacy
  selectedIdeas: string[];
}

// --- FULL SESSION TYPES ---

export type AxisId = 'processes' | 'digitalProducts' | 'businessModels' | 'dataManagement' | 'culture' | 'aiMaturity';

export interface AssessmentAxis {
  score: number;
  answers: number[]; // 1-7 scale values
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
}

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5' | 'Q6' | 'Q7' | 'Q8';
export type Wave = 'Wave 1' | 'Wave 2' | 'Wave 3';
export type InitiativeStatus = 'Draft' | 'Ready' | 'Archived' | 'To Do' | 'In Progress' | 'Blocked' | 'Done';

export type CostRange = 'Low (<$10k)' | 'Medium ($10k-$50k)' | 'High (>$50k)';
export type BenefitRange = 'Low (<$20k/yr)' | 'Medium ($20k-$100k/yr)' | 'High (>$100k/yr)';

export interface FullInitiative {
  id: string;
  name: string;
  description?: string;
  axis: AxisId;
  priority: 'High' | 'Medium' | 'Low';
  complexity: 'High' | 'Medium' | 'Low';
  status: InitiativeStatus;
  notes?: string;
  quarter?: Quarter;
  wave?: Wave;

  // Economics
  estimatedCost?: number;
  estimatedAnnualBenefit?: number;
  costRange?: CostRange;
  benefitRange?: BenefitRange;

  // Step 5 Execution Fields
  owner?: string;
  dueDate?: string; // ISO Date String
  progress?: number; // 0-100
}

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
}

export interface FullSession {
  assessment: {
    processes: AssessmentAxis;
    digitalProducts: AssessmentAxis;
    businessModels: AssessmentAxis;
    dataManagement: AssessmentAxis;
    culture: AssessmentAxis;
    aiMaturity: AssessmentAxis;
    completedAxes: AxisId[];
  };
  initiatives: FullInitiative[];
  economics?: EconomicsSummary;
  report?: FullReport;

  step1Completed: boolean;
  step2Completed: boolean;
  step3Completed: boolean;
  step4Completed: boolean;
  step5Completed: boolean;
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
