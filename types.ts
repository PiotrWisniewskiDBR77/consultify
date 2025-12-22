
export enum AppView {
  WELCOME = 'WELCOME',
  AUTH = 'AUTH',
  DASHBOARD = 'DASHBOARD',
  USER_DASHBOARD = 'USER_DASHBOARD',
  DASHBOARD_OVERVIEW = 'DASHBOARD_OVERVIEW',
  DASHBOARD_SNAPSHOT = 'DASHBOARD_SNAPSHOT',

  // Quick Assessment
  QUICK_STEP1_PROFILE = 'QUICK_STEP1_PROFILE',
  QUICK_STEP2_USER_CONTEXT = 'QUICK_STEP2_USER_CONTEXT',
  QUICK_STEP3_EXPECTATIONS = 'QUICK_STEP3_EXPECTATIONS',
  TRIAL_ENTRY = 'TRIAL_ENTRY', // Phase C: Controlled Trial Selection

  // Full Transformation Views
  ONBOARDING_WIZARD = 'ONBOARDING_WIZARD', // Phase E: Guided First Value
  ORG_SETUP_WIZARD = 'ORG_SETUP_WIZARD', // Phase D: Organization Setup
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
  FULL_STEP5_EXECUTION = 'FULL_STEP5_EXECUTION', // Keepingfor backward compat
  FULL_PILOT_EXECUTION = 'FULL_PILOT_EXECUTION', // Module 4
  FULL_ROLLOUT = 'FULL_ROLLOUT', // Module 5
  FULL_STEP6_REPORTS = 'FULL_STEP6_REPORTS',
  KPI_OKR_DASHBOARD = 'KPI_OKR_DASHBOARD', // Module: KPI/OKR post-implementation tracking


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
  ADMIN_METRICS = 'ADMIN_METRICS',
  SETTINGS_PROFILE = 'SETTINGS_PROFILE',
  SETTINGS_BILLING = 'SETTINGS_BILLING',
  SETTINGS_AI = 'SETTINGS_AI',
  SETTINGS_NOTIFICATIONS = 'SETTINGS_NOTIFICATIONS',
  SETTINGS_INTEGRATIONS = 'SETTINGS_INTEGRATIONS',
  SETTINGS_REGIONALIZATION = 'SETTINGS_REGIONALIZATION',
  SETTINGS_ORGANIZATION = 'SETTINGS_ORGANIZATION', // NEW

  // Context Builder (Renamed directly or used as parent)
  CONTEXT_BUILDER = 'CONTEXT_BUILDER',
  CONTEXT_BUILDER_PROFILE = 'CONTEXT_BUILDER_PROFILE',
  CONTEXT_BUILDER_GOALS = 'CONTEXT_BUILDER_GOALS',
  CONTEXT_BUILDER_CHALLENGES = 'CONTEXT_BUILDER_CHALLENGES',
  CONTEXT_BUILDER_MEGATRENDS = 'CONTEXT_BUILDER_MEGATRENDS',
  CONTEXT_BUILDER_STRATEGY = 'CONTEXT_BUILDER_STRATEGY',

  // Teamwork Views
  MY_WORK = 'MY_WORK', // New Module 7 (Tasks & Workflow)

  // Step D: Executive View (Read-only reporting for executives)
  EXECUTIVE_VIEW = 'EXECUTIVE_VIEW',

  // AI Action Proposals Review
  AI_ACTION_PROPOSALS = 'AI_ACTION_PROPOSALS',

  // Consultant Views
  CONSULTANT_PANEL = 'CONSULTANT_PANEL',
  CONSULTANT_INVITES = 'CONSULTANT_INVITES',

  // Step 13: Visual Playbook Editor
  SUPERADMIN_PLAYBOOK_TEMPLATES = 'SUPERADMIN_PLAYBOOK_TEMPLATES',
  SUPERADMIN_PLAYBOOK_EDITOR = 'SUPERADMIN_PLAYBOOK_EDITOR',
  ADMIN_PLAYBOOK_RUNS = 'ADMIN_PLAYBOOK_RUNS',

  // Org Admin Consultant Views
  ADMIN_SETTINGS_CONSULTANTS = 'ADMIN_SETTINGS_CONSULTANTS',

  // Ecosystem (Phase G)
  AFFILIATE_DASHBOARD = 'AFFILIATE_DASHBOARD'
}

// SCMS: Canonical Change Lifecycle Phases (System Reframe Step 0)
export enum SCMSPhase {
  PHASE_1_CONTEXT = 'Context',          // AppView.FULL_STEP1_CONTEXT
  PHASE_2_ASSESSMENT = 'Assessment',    // AppView.FULL_STEP1_ASSESSMENT
  PHASE_3_INITIATIVES = 'Initiatives',  // AppView.FULL_STEP2_INITIATIVES
  PHASE_4_ROADMAP = 'Roadmap',          // AppView.FULL_STEP3_ROADMAP
  PHASE_5_EXECUTION = 'Execution',      // AppView.FULL_STEP5_EXECUTION + FULL_PILOT_EXECUTION
  PHASE_6_STABILIZATION = 'Stabilization' // AppView.FULL_ROLLOUT + FULL_STEP6_REPORTS
}

export enum SessionMode {
  FREE = 'FREE',
  FULL = 'FULL',
  DEMO = 'DEMO'  // Phase B: Read-only demo experience
}

export enum AuthStep {
  LOGIN = 'LOGIN',
  REGISTER = 'REGISTER',
  CODE_ENTRY = 'CODE_ENTRY'
}

// SCMS: Canonical Roles (Step 1)
export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',   // DBR77 Platform Owner
  ADMIN = 'ADMIN',             // Tenant Admin (CEO/COO usually)
  PROJECT_MANAGER = 'PROJECT_MANAGER', // PMO Lead
  TEAM_MEMBER = 'TEAM_MEMBER', // Executor
  VIEWER = 'VIEWER',            // Stakeholder/Auditor
  CEO = 'CEO',
  MANAGER = 'MANAGER',
  CONSULTANT = 'CONSULTANT',   // External Advisor
  OTHER = 'OTHER'
}

// SCMS: System Capabilities (Permissions)
export type Capability =
  // Tenant Admin Scope
  | 'manage_users'
  | 'manage_roles'
  | 'manage_billing'
  | 'manage_org_settings'
  | 'manage_ai_policy'

  // Project Governance Scope
  | 'create_project'
  | 'edit_project_settings'
  | 'manage_project_roles'
  | 'manage_workstreams'
  | 'approve_changes'         // CR Approval
  | 'manage_stage_gates'      // Phase Transitions
  | 'view_audit_log'

  // Execution Scope
  | 'create_initiative'
  | 'edit_initiative'
  | 'manage_roadmap'
  | 'assign_tasks'
  | 'update_task_status'
  | 'manage_risks'

  // AI Scope
  | 'ai_execute_actions'      // "Auto" mode
  | 'ai_view_insights';

// Governance: Change Request Status
export type ChangeRequestStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'IMPLEMENTED';

// Governance: Change Request Type
export type ChangeRequestType = 'SCOPE' | 'SCHEDULE' | 'BUDGET' | 'GOVERNANCE' | 'RESOURCE';

// Governance: Change Request Entity
export interface ChangeRequest {
  id: string;
  projectId: string;
  title: string;
  description: string;
  type: ChangeRequestType;
  status: ChangeRequestStatus;

  // Impact Analysis
  impactedObjects: { type: 'initiative' | 'task' | 'milestone'; id: string }[];
  riskAssessment: 'LOW' | 'MEDIUM' | 'HIGH';
  rationale: string;

  // Workflow
  createdBy: string;
  createdAt: string;
  approvers?: string[]; // List of UserIDs who must approve
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;

  // AI
  aiRecommendedDecision?: 'APPROVE' | 'REJECT' | 'REQUEST_INFO';
  aiAnalysis?: string;
}

// Governance: Policy Settings (Tenant or Project Level)
export interface GovernancePolicy {
  id: string;
  scopeId: string;   // OrgID or ProjectID
  scopeType: 'ORGANIZATION' | 'PROJECT';

  // Rules
  requireChangeRequestFor: ('SCOPE' | 'SCHEDULE' | 'BUDGET')[];
  approvalThresholdCost?: number; // e.g., > $10k requires specific approval

  // AI strictness
  aiMode: 'ADVISORY' | 'ASSISTED' | 'PROACTIVE' | 'AUTOPILOT';
  allowedAiActions: Capability[]; // Which actions AI can take without human loop
}

// ==========================================
// STEP 3: PMO OBJECT MODEL
// ==========================================

// 3.1 STANDARDIZED STATUS ENUMS

/** Initiative Status Lifecycle (ENFORCED) */
export enum InitiativeStatus {
  DRAFT = 'DRAFT',
  PLANNED = 'PLANNED',
  APPROVED = 'APPROVED',
  IN_EXECUTION = 'IN_EXECUTION',
  BLOCKED = 'BLOCKED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

/** Task Status Lifecycle (ENFORCED) */
export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  DONE = 'DONE'
}

/** Decision Status */
export enum DecisionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

/** Dependency Types */
export enum DependencyType {
  FINISH_TO_START = 'FINISH_TO_START', // Hard dependency
  SOFT = 'SOFT'                         // Informational only
}

/** Stage Gate Types */
export enum StageGateType {
  READINESS_GATE = 'READINESS_GATE',     // Context → Assessment
  DESIGN_GATE = 'DESIGN_GATE',           // Assessment → Initiatives
  PLANNING_GATE = 'PLANNING_GATE',       // Initiatives → Roadmap
  EXECUTION_GATE = 'EXECUTION_GATE',     // Roadmap → Execution
  CLOSURE_GATE = 'CLOSURE_GATE'          // Execution → Stabilization
}

// ==========================================
// META-PMO FRAMEWORK: CERTIFIABLE DOMAINS
// Standards: ISO 21500, PMI PMBOK 7th Ed, PRINCE2
// ==========================================

/**
 * PMO Domain IDs - Certifiable Core Domains
 * 
 * These 7 domains represent the common denominators across professional PMO standards.
 * Each is methodology-neutral and can be traced to ISO 21500, PMBOK, and PRINCE2.
 * 
 * @mapping ISO 21500: Subject Groups
 * @mapping PMBOK 7: Performance Domains
 * @mapping PRINCE2: Themes
 */
export enum PMODomainId {
  /** 
   * Governance & Decision Making
   * @iso21500 Integration Subject Group (Decision Making)
   * @pmbok7 Stakeholder Performance Domain / Project Governance
   * @prince2 Organization Theme / Exception Management
   */
  GOVERNANCE_DECISION_MAKING = 'GOVERNANCE_DECISION_MAKING',

  /** 
   * Scope & Change Control
   * @iso21500 Scope Subject Group
   * @pmbok7 Development Approach & Life Cycle Performance Domain
   * @prince2 Change Theme / Configuration Management
   */
  SCOPE_CHANGE_CONTROL = 'SCOPE_CHANGE_CONTROL',

  /** 
   * Schedule & Milestones
   * @iso21500 Time Subject Group
   * @pmbok7 Planning Performance Domain / Schedule Management
   * @prince2 Plans Theme / Stage
   */
  SCHEDULE_MILESTONES = 'SCHEDULE_MILESTONES',

  /** 
   * Risk & Issue Management
   * @iso21500 Risk Subject Group
   * @pmbok7 Uncertainty Performance Domain
   * @prince2 Risk Theme
   */
  RISK_ISSUE_MANAGEMENT = 'RISK_ISSUE_MANAGEMENT',

  /** 
   * Resource & Responsibility
   * @iso21500 Resource Subject Group
   * @pmbok7 Team Performance Domain
   * @prince2 Organization Theme (Roles & Responsibilities)
   */
  RESOURCE_RESPONSIBILITY = 'RESOURCE_RESPONSIBILITY',

  /** 
   * Performance Monitoring
   * @iso21500 Integration Subject Group (Control)
   * @pmbok7 Measurement Performance Domain
   * @prince2 Progress Theme
   */
  PERFORMANCE_MONITORING = 'PERFORMANCE_MONITORING',

  /** 
   * Benefits Realization (Placeholder for future enhancement)
   * @iso21500 Integration Subject Group (Benefits)
   * @pmbok7 Delivery Performance Domain / Benefits Management
   * @prince2 Business Case Theme
   */
  BENEFITS_REALIZATION = 'BENEFITS_REALIZATION'
}

/**
 * PMO Standards Mapping - Explicit terminology mapping for certification
 * 
 * Each SCMS concept maps to its equivalent in professional standards.
 * This enables auditors to trace SCMS terminology to known norms.
 */
export interface PMOStandardMapping {
  /** The SCMS concept name (e.g., 'Phase', 'Decision') */
  scmsConcept: string;
  /** The SCMS TypeScript object (e.g., 'SCMSPhase', 'Decision') */
  scmsObject: string;
  /** ISO 21500:2021 equivalent term */
  iso21500Term: string;
  /** ISO 21500 clause reference */
  iso21500Clause?: string;
  /** PMI PMBOK 7th Edition equivalent term */
  pmbokTerm: string;
  /** PMBOK Performance Domain */
  pmbokDomain?: string;
  /** PRINCE2 equivalent term */
  prince2Term: string;
  /** PRINCE2 Theme */
  prince2Theme?: string;
  /** Which PMO domain this belongs to */
  domainId: PMODomainId;
  /** Methodology-neutral description */
  description: string;
}

/**
 * PMO Domain - First-class certifiable domain concept
 * 
 * Each domain is:
 * - Optional and configurable per project
 * - Named with neutral terminology
 * - Mappable to ISO/PMBOK/PRINCE2
 */
export interface PMODomain {
  /** Unique domain identifier */
  id: PMODomainId;
  /** Display name (neutral terminology) */
  name: string;
  /** Description of domain scope */
  description: string;
  /** ISO 21500 equivalent terminology */
  iso21500Term: string;
  /** PMBOK 7th Edition equivalent terminology */
  pmbokTerm: string;
  /** PRINCE2 equivalent terminology */
  prince2Term: string;
  /** Whether this domain can be enabled/disabled per project */
  isConfigurable: boolean;
  /** SCMS objects that belong to this domain */
  scmsObjects: string[];
  /** Notes for certification auditors */
  certificationNotes?: string;
}

/**
 * Project PMO Configuration - Per-project domain enablement
 * 
 * Allows projects to:
 * - Enable/disable specific domains
 * - Customize phase/gate labels
 * - Configure governance without methodology lock-in
 */
export interface ProjectPMOConfiguration {
  projectId: string;
  /** Array of enabled domain IDs */
  enabledDomains: PMODomainId[];
  /** Custom phase names (optional) */
  phaseLabels?: Record<string, string>;
  /** Custom gate names (optional) */
  gateLabels?: Record<string, string>;
  /** Custom domain names (optional) */
  domainLabels?: Record<PMODomainId, string>;
}

/**
 * PMO Auditable Object - Base interface for certification traceability
 * 
 * Any PMO object implementing this interface can be traced
 * back to its domain, phase, and standards equivalents.
 */
export interface PMOAuditableObject {
  /** The PMO domain this object belongs to */
  pmoDomainId: PMODomainId;
  /** The phase when this was created/modified */
  pmoPhase: SCMSPhase;
  /** Optional explicit standards mapping for this instance */
  standardsMapping?: {
    iso21500: string;
    pmbok: string;
    prince2: string;
  };
}

/**
 * PMO Audit Entry - Individual audit trail record
 * 
 * Captures every governance action with full traceability:
 * - Domain → Standard terminology
 * - Phase → Lifecycle position
 * - Action → What was done
 */
export interface PMOAuditEntry {
  id: string;
  projectId: string;
  pmoDomainId: PMODomainId;
  pmoPhase: SCMSPhase;
  /** Type of PMO object (DECISION, BASELINE, CHANGE_REQUEST, etc.) */
  objectType: string;
  objectId: string;
  /** Action performed (CREATED, APPROVED, REJECTED, etc.) */
  action: string;
  actorId?: string;
  /** ISO 21500 term at time of action */
  iso21500Mapping: string;
  /** PMBOK term at time of action */
  pmbokMapping: string;
  /** PRINCE2 term at time of action */
  prince2Mapping: string;
  /** Additional context */
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// 3.2 PORTFOLIO (Implicit per Organization)

export interface Portfolio {
  organizationId: string;

  // Aggregated Metrics
  totalProjects: number;
  activeProjects: number;
  projectsOnTrack: number;
  projectsAtRisk: number;
  projectsBlocked: number;

  // Capacity
  totalInitiatives: number;
  completedInitiatives: number;
  overallProgress: number; // 0-100

  // Health
  healthScore: number; // 0-100
  topRisks: string[];
}

// 3.3 TRANSFORMATION PROJECT

export interface TransformationProject {
  id: string;
  organizationId: string;
  name: string;

  // Governance
  sponsorId: string;           // REQUIRED: Executive Sponsor
  decisionOwnerId: string;     // REQUIRED: Final decision maker
  projectManagerId?: string;

  // Scope
  locationsInScope: string[];  // Site/Location IDs

  // Timeline
  startDate?: string;
  targetEndDate?: string;

  // Phase Tracking (1-6)
  currentPhase: SCMSPhase;
  phaseHistory: { phase: SCMSPhase; enteredAt: string; exitedAt?: string }[];

  // Settings
  governanceSettings: {
    requireApprovalForPhaseTransition: boolean;
    allowPhaseRollback: boolean;
    stageGatesEnabled: boolean;
  };

  // Progress
  progress: number; // 0-100 (calculated from initiatives)
  status: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

  createdAt: string;
  updatedAt: string;
}

// 3.4 INITIATIVE (Core Unit of Change)

export interface PMOInitiative {
  id: string;
  projectId: string;           // REQUIRED: Must belong to exactly one project
  ownerId: string;             // REQUIRED: Must have exactly one owner

  // Core Attributes
  title: string;
  description: string;

  // Scope
  relatedLocationIds: string[]; // May span multiple locations

  // Status & Priority
  status: InitiativeStatus;
  blockedReason?: string;      // Required if status = BLOCKED
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

  // Dependencies
  dependsOn: { initiativeId: string; type: DependencyType }[];

  // Related Decisions
  relatedDecisionIds: string[];

  // Progress (calculated)
  progress: number;            // 0-100 (from tasks)
  totalTasks: number;
  completedTasks: number;

  // Roadmap
  waveId?: string;
  baselineVersion: number;

  // Audit
  createdAt: string;
  updatedAt: string;
}

// 3.5 TASK (Execution Unit)

export interface PMOTask {
  id: string;
  initiativeId: string;        // REQUIRED: Must belong to exactly one initiative
  projectId: string;           // Denormalized for queries

  // Core Attributes
  title: string;
  description?: string;

  // Assignment
  assigneeId?: string;

  // Execution
  status: TaskStatus;
  blockedReason?: string;      // Required if status = BLOCKED
  blockerType?: 'RISK' | 'DECISION' | 'DEPENDENCY' | 'RESOURCE' | 'OTHER';

  // Timeline
  dueDate?: string;
  effortEstimate?: number;     // Hours (lightweight)

  // Evidence
  attachments?: { id: string; name: string; url: string }[];
  evidence?: string;

  // Progress
  progress: number;            // 0-100

  // Audit
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// 3.6 DECISION (Governance Checkpoint)

export interface Decision {
  id: string;
  projectId: string;

  // Type
  decisionType: 'INITIATIVE_APPROVAL' | 'PHASE_TRANSITION' | 'UNBLOCK' | 'CANCEL' | 'OTHER';

  // Related Object
  relatedObjectType: 'INITIATIVE' | 'PHASE' | 'ROADMAP' | 'TASK';
  relatedObjectId: string;

  // Ownership
  decisionOwnerId: string;     // Single owner (no voting)

  // Status
  status: DecisionStatus;
  required: boolean;           // Based on project governance settings

  // Details
  title: string;
  description?: string;
  outcome?: string;            // Notes from decision maker

  // Audit
  createdAt: string;
  decidedAt?: string;
  auditTrail: { action: string; by: string; at: string; notes?: string }[];
}

// 3.7 STAGE GATE

export interface StageGate {
  id: string;
  projectId: string;

  // Gate Definition
  gateType: StageGateType;
  fromPhase: SCMSPhase;
  toPhase: SCMSPhase;

  // Criteria
  completionCriteria: {
    criterion: string;
    isMet: boolean;
    evidence?: string;
  }[];

  // Status
  status: 'NOT_READY' | 'READY' | 'PASSED' | 'FAILED';
  requiresApproval: boolean;

  // Audit
  evaluatedAt?: string;
  evaluatedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  notes?: string;
}

// 3.8 INITIATIVE DEPENDENCY

export interface InitiativeDependency {
  id: string;
  fromInitiativeId: string;    // Depends on
  toInitiativeId: string;      // Dependent
  type: DependencyType;

  // Status
  isSatisfied: boolean;

  createdAt: string;
}

// ==========================================
// STEP 4: ROADMAP, SEQUENCING & CAPACITY
// ==========================================

/** Roadmap: Time-based execution plan for initiatives */
export interface Roadmap {
  id: string;
  projectId: string;
  name: string;

  // Status
  status: 'DRAFT' | 'ACTIVE' | 'BASELINED' | 'ARCHIVED';

  // Timeline
  plannedStartDate?: string;
  plannedEndDate?: string;

  // Metadata
  currentBaselineVersion: number;
  lastBaselinedAt?: string;

  createdAt: string;
  updatedAt: string;
}

/** RoadmapInitiative: Initiative with timeline data on roadmap */
export interface RoadmapInitiative {
  id: string;         // Same as initiative.id
  roadmapId: string;
  initiativeId: string;

  // Planned (from baseline)
  plannedStartDate: string;
  plannedEndDate: string;
  plannedDuration: number;  // Days
  sequencePosition: number;

  // Actual
  actualStartDate?: string;
  actualEndDate?: string;

  // Flags
  isMilestone: boolean;
  isCriticalPath: boolean;

  // Variance
  startVarianceDays?: number;  // Actual - Planned
  endVarianceDays?: number;
}

/** ScheduleBaseline: Captured roadmap snapshot */
export interface ScheduleBaseline {
  id: string;
  roadmapId: string;
  projectId: string;

  // Version
  version: number;

  // Snapshot
  initiativeSnapshots: {
    initiativeId: string;
    plannedStartDate: string;
    plannedEndDate: string;
    sequencePosition: number;
  }[];

  // Approval
  approvedBy: string;
  approvedAt: string;
  rationale: string;

  createdAt: string;
}

/** CapacityEntry: User workload tracking */
export interface CapacityEntry {
  userId: string;
  weekStart: string;  // Monday of the week

  // Hours
  allocatedHours: number;
  availableHours: number;  // Default: 40
  utilizationPercent: number;

  // Breakdown
  initiativeAllocations: {
    initiativeId: string;
    hours: number;
  }[];

  // Status
  isOverloaded: boolean;
}

/** Scenario: What-if simulation (non-persistent) */
export interface Scenario {
  id: string;
  projectId: string;
  name: string;

  // Changes
  proposedChanges: {
    initiativeId: string;
    field: 'plannedStartDate' | 'plannedEndDate' | 'sequencePosition';
    originalValue: string | number;
    newValue: string | number;
  }[];

  // Impact Analysis
  impactAnalysis?: {
    affectedInitiatives: string[];
    dependencyBreaks: string[];
    capacityOverloads: string[];
    delayedByDays: number;
  };

  createdAt: string;
  createdBy: string;
}

/** VarianceReport: Baseline vs Actual comparison */
export interface VarianceReport {
  projectId: string;
  roadmapId: string;
  baselineVersion: number;

  // Summary
  totalInitiatives: number;
  onTrackCount: number;
  delayedCount: number;
  criticalDelays: number;
  onTrackPercent: number;

  // Details
  initiativeVariances: {
    initiativeId: string;
    initiativeName: string;
    plannedStart: string;
    plannedEnd: string;
    actualStart?: string;
    actualEnd?: string;
    startVarianceDays: number;
    endVarianceDays: number;
    status: 'ON_TRACK' | 'DELAYED' | 'CRITICAL' | 'EARLY';
  }[];

  generatedAt: string;
}

// ==========================================
// STEP 5: EXECUTION CONTROL, MY WORK & NOTIFICATIONS
// ==========================================

/** Notification Types */
export type NotificationType =
  // Execution
  | 'TASK_ASSIGNED'
  | 'TASK_OVERDUE'
  | 'TASK_BLOCKED'
  | 'INITIATIVE_STARTED'
  | 'INITIATIVE_STALLED'
  | 'INITIATIVE_COMPLETED'
  // Governance
  | 'DECISION_REQUIRED'
  | 'DECISION_OVERDUE'
  | 'CHANGE_REQUEST_SUBMITTED'
  | 'CHANGE_REQUEST_DECIDED'
  | 'GATE_PENDING_APPROVAL'
  // AI
  | 'AI_RISK_DETECTED'
  | 'AI_OVERLOAD_DETECTED'
  | 'AI_DEPENDENCY_CONFLICT'
  | 'AI_RECOMMENDATION';

/** Notification Severity */
export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

/** Notification Entity */
export interface Notification {
  id: string;
  userId: string;
  organizationId: string;
  projectId?: string;

  // Type & Severity
  type: NotificationType;
  severity: NotificationSeverity;

  // Content
  title: string;
  message: string;

  // Related Object
  relatedObjectType?: 'TASK' | 'INITIATIVE' | 'DECISION' | 'PROJECT' | 'GATE';
  relatedObjectId?: string;

  // Legacy Data Support
  data?: {
    link?: string;
    actionLabel?: string;
    priority?: string;
    [key: string]: any;
  };

  // Status
  isRead: boolean;
  isActionable: boolean;
  actionUrl?: string;

  // Timestamps
  createdAt: string;
  readAt?: string;
  expiresAt?: string;
}

/** User Notification Settings */
export interface UserNotificationSettings {
  userId: string;

  // Channels
  inAppEnabled: boolean;
  emailEnabled: boolean;

  // Filters
  muteInfo: boolean;
  muteWarning: boolean;
  muteCritical: boolean;

  // Specific types
  mutedTypes: NotificationType[];
}

/** MyWork Aggregation */
export interface MyWork {
  userId: string;
  generatedAt: string;

  // Tasks Section
  myTasks: {
    total: number;
    overdue: number;
    dueToday: number;
    blocked: number;
    items: {
      id: string;
      title: string;
      initiativeName: string;
      projectName: string;
      dueDate?: string;
      status: string;
      priority: string;
      blockedReason?: string;
    }[];
  };

  // Initiatives Section (for Owners/PMs)
  myInitiatives?: {
    total: number;
    atRisk: number;
    items: {
      id: string;
      name: string;
      projectName: string;
      status: string;
      progress: number;
      blockers: string[];
      pendingDecisions: number;
    }[];
  };

  // Decisions Section (for Decision Owners)
  myDecisions?: {
    total: number;
    overdue: number;
    items: {
      id: string;
      title: string;
      projectName: string;
      decisionType: string;
      createdAt: string;
      isOverdue: boolean;
    }[];
  };

  // Alerts Section
  myAlerts: {
    total: number;
    critical: number;
    items: Notification[];
  };
}

/** Escalation Request */
export interface EscalationRequest {
  id: string;
  projectId: string;

  // Source
  sourceType: 'DECISION' | 'INITIATIVE' | 'TASK' | 'CAPACITY';
  sourceId: string;

  // Escalation Path
  fromUserId: string;
  toUserId: string;
  toRole: string;

  // Reason
  reason: string;
  triggerType: 'OVERDUE' | 'STALLED' | 'OVERLOAD' | 'MANUAL';
  daysOverdue?: number;

  // Status
  status: 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVED';

  // Audit
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

// ==========================================
// AI TRUST & EXPLAINABILITY LAYER
// ==========================================

/**
 * AI Confidence Level - Computed deterministically based on data quality
 * 
 * Rules:
 * - LOW: Missing data, conflicting signals, or no PMOHealthSnapshot
 * - MEDIUM: Partial data available, heuristics used, or blockers present
 * - HIGH: Strong PMOHealthSnapshot signals, no missing blockers, full context
 */
export enum AIConfidenceLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

/**
 * AI Explanation Object - Attached to every AI response
 * 
 * This object ensures every AI output is:
 * - Explainable (reasoningSummary)
 * - Traceable (dataUsed)
 * - Auditable (timestamp, stored in audit log)
 * - Defensible (constraintsApplied)
 */
export interface AIExplanation {
  /** The active AI role for this interaction */
  aiRole: AIProjectRole;

  /** Whether regulatory/compliance mode is active */
  regulatoryMode: boolean;

  /** Computed confidence based on data quality */
  confidenceLevel: AIConfidenceLevel;

  /** Human-readable summary of reasoning (not LLM-dependent) */
  reasoningSummary: string;

  /** Data sources used for this response */
  dataUsed: {
    /** Whether project-specific data was available */
    projectData: boolean;
    /** Number of project memory items consulted */
    projectMemoryCount: number;
    /** List of external sources used (if any) */
    externalSources: string[];
  };

  /** List of governance constraints that affected the response */
  constraintsApplied: string[];

  /** ISO 8601 timestamp when explanation was generated */
  timestamp: string;
}

// ==========================================
// INVITATION SYSTEM (Enterprise B2B Collaboration)
// Supports organization and project-level invitations
// ==========================================

/** Invitation Types */
export enum InvitationType {
  ORG = 'ORG',
  PROJECT = 'PROJECT'
}

/** Invitation Status Lifecycle */
export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  REVOKED = 'revoked'
}

/** Invitation Event Types (Audit Trail) */
export enum InvitationEventType {
  CREATED = 'created',
  SENT = 'sent',
  RESENT = 'resent',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  REVOKED = 'revoked'
}

/** Invitation - Token-based invitation to organization or project */
export interface Invitation {
  id: string;
  invitationType: InvitationType;
  organizationId: string;
  organizationName?: string;
  projectId?: string;
  projectName?: string;
  email: string;
  roleToAssign: string;
  token?: string; // Only returned when creating
  status: InvitationStatus;
  expiresAt: string;
  invitedByUserId: string;
  invitedBy?: {
    firstName: string;
    lastName: string;
  };
  acceptedByUserId?: string;
  acceptedAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/** Invitation Event - Audit trail entry */
export interface InvitationEvent {
  id: string;
  invitationId: string;
  eventType: InvitationEventType;
  performedBy?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  performedByUserId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/** Invitation Validation Response */
export interface InvitationValidation {
  valid: boolean;
  invitationType: InvitationType;
  organizationName: string;
  projectName?: string;
  email: string;
  roleToAssign: string;
  expiresAt: string;
}

// ==========================================
// STEP 6: STABILIZATION, REPORTING & ECONOMICS
// ==========================================

/** Stabilization Status for Initiatives */
export type StabilizationStatus = 'STABILIZED' | 'PARTIALLY_STABILIZED' | 'UNSTABLE' | 'NOT_APPLICABLE';

/** Value Hypothesis Types */
export type ValueHypothesisType = 'COST_REDUCTION' | 'REVENUE_INCREASE' | 'RISK_REDUCTION' | 'EFFICIENCY' | 'STRATEGIC_OPTION';

/** Value Hypothesis - Expected benefit of an initiative */
export interface ValueHypothesis {
  id: string;
  initiativeId: string;
  projectId: string;

  // Core
  description: string;
  type: ValueHypothesisType;
  confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH';

  // Ownership
  ownerId: string;

  // Linked initiatives
  relatedInitiativeIds: string[];

  // Status
  isValidated: boolean;
  validatedAt?: string;
  validatedBy?: string;

  createdAt: string;
  updatedAt: string;
}

/** Financial Assumption - Order-of-magnitude estimates */
export interface FinancialAssumption {
  id: string;
  valueHypothesisId: string;

  // Range-based (non-binding)
  lowEstimate?: number;
  expectedEstimate?: number;
  highEstimate?: number;
  currency: string;
  timeframe: string; // e.g., "per year", "one-time"

  // Metadata
  notes?: string;
  isNonBinding: boolean; // Always true

  createdAt: string;
}

/** Executive Report - High-level overview */
export interface ExecutiveReport {
  reportType: 'EXECUTIVE_OVERVIEW' | 'PROJECT_HEALTH' | 'GOVERNANCE' | 'BRIEFING';
  generatedAt: string;
  generatedBy: string;

  // Portfolio Summary
  portfolioHealth: {
    totalProjects: number;
    activeProjects: number;
    onTrack: number;
    atRisk: number;
    blocked: number;
  };

  // Phase Distribution
  phaseDistribution: {
    phase: string;
    count: number;
  }[];

  // Top Risks
  topRisks: string[];

  // Pending Decisions
  pendingDecisions: number;
  overdueDecisions: number;

  // Baseline Variance
  initiativesOnTrack: number;
  initiativesDelayed: number;

  // Stabilization
  stabilizationSummary?: {
    stabilized: number;
    partiallyStabilized: number;
    unstable: number;
  };

  // AI Narrative
  aiNarrative: string;
  changesSinceLastReview: string[];
}

/** Project Closure - Formal end of project */
export interface ProjectClosure {
  id: string;
  projectId: string;

  // Closure Details
  closureType: 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
  closureDate: string;
  closedBy: string;

  // Summary
  lessonsLearned?: string;
  finalStatus: string;

  // Metrics at Closure
  totalInitiatives: number;
  completedInitiatives: number;
  cancelledInitiatives: number;

  // Value Realization
  valueHypothesesValidated: number;
  valueHypothesesTotal: number;

  // Audit
  approvedBy?: string;
  approvedAt?: string;
}

// ==========================================
// AI CORE LAYER — ENTERPRISE PMO BRAIN
// ==========================================

/** AI Policy Levels - Control what AI can do */
export type AIPolicyLevel = 'ADVISORY' | 'ASSISTED' | 'PROACTIVE' | 'AUTOPILOT';

/** AI Role - Runtime behavior mode */
export type AIRole = 'ADVISOR' | 'PMO_MANAGER' | 'EXECUTOR' | 'EDUCATOR';

// ==========================================
// AI ROLES MODEL — PROJECT-LEVEL GOVERNANCE
// ==========================================

/** AI Project Role - Hierarchical governance level (ADVISOR < MANAGER < OPERATOR) */
export enum AIProjectRole {
  ADVISOR = 'ADVISOR',   // Explains, suggests, warns - cannot modify data
  MANAGER = 'MANAGER',   // Prepares drafts - requires explicit approval
  OPERATOR = 'OPERATOR'  // Executes approved actions within governance
}

/** AI Role Capabilities - What each role can do */
export interface AIRoleCapabilities {
  canExplain: boolean;
  canSuggest: boolean;
  canAnalyze: boolean;
  canCreateDrafts: boolean;
  canExecuteActions: boolean;
  canModifyEntities: boolean;
  requiresApproval: boolean;
}

/** AI Role Configuration for Projects */
export interface AIRoleConfig {
  activeRole: AIProjectRole;
  capabilities: AIRoleCapabilities;
  roleDescription: string;
}

/** AI Chat Mode - User-selectable intent */
export type AIChatMode = 'EXPLAIN' | 'GUIDE' | 'ANALYZE' | 'DO' | 'TEACH';

/** AI Action Type */
export type AIActionType =
  | 'CREATE_DRAFT_TASK'
  | 'CREATE_DRAFT_INITIATIVE'
  | 'SUGGEST_ROADMAP_CHANGE'
  | 'GENERATE_REPORT'
  | 'PREPARE_DECISION_SUMMARY'
  | 'EXPLAIN_CONTEXT'
  | 'ANALYZE_RISKS';

/** Platform Context Layer */
export interface AIPlatformContext {
  role: 'SUPERADMIN' | 'ADMIN' | 'USER';
  tenantId: string;
  userId: string;
  policyLevel: AIPolicyLevel;
  globalPolicies: {
    internetEnabled: boolean;
    maxPolicyLevel: AIPolicyLevel;
    auditRequired: boolean;
  };
}

/** Organization Context Layer */
export interface AIOrganizationContext {
  organizationId: string;
  organizationName: string;
  locations: string[];
  activeProjectIds: string[];
  activeProjectCount: number;
  pmoMaturityLevel?: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
}

/** Project Context Layer */
export interface AIProjectContext {
  projectId: string;
  projectName: string;
  currentPhase: string;
  phaseNumber: number;
  governanceRules: {
    requireApprovalForPhaseTransition: boolean;
    stageGatesEnabled: boolean;
    aiPolicyOverride?: AIPolicyLevel;
  };
  sponsorId?: string;
  projectManagerId?: string;
  roadmapStatus?: string;
  initiativeCount: number;
  completedInitiatives: number;
}

/** Execution Context Layer */
export interface AIExecutionContext {
  userId: string;
  userTasks: { id: string; title: string; status: string; dueDate?: string }[];
  userInitiatives: { id: string; name: string; status: string }[];
  pendingDecisions: { id: string; title: string; createdAt: string }[];
  blockers: { id: string; type: string; description: string }[];
  capacityStatus: 'HEALTHY' | 'WARNING' | 'OVERLOADED';
}

/** Knowledge Context Layer */
export interface AIKnowledgeContext {
  projectDocuments: { id: string; name: string; type: string }[];
  previousDecisions: { id: string; title: string; outcome: string }[];
  changeRequests: { id: string; title: string; status: string }[];
  lessonsLearned: string[];
  phaseHistory: { phase: string; enteredAt: string }[];
}

/** External Context Layer */
export interface AIExternalContext {
  internetEnabled: boolean;
  externalSourcesUsed: string[];
}

/** Complete 6-Layer AI Context */
export interface AIContext {
  platform: AIPlatformContext;
  organization: AIOrganizationContext;
  project?: AIProjectContext;
  execution: AIExecutionContext;
  knowledge: AIKnowledgeContext;
  external: AIExternalContext;

  // Meta
  builtAt: string;
  contextHash: string;
  currentScreen?: string;
  selectedObjectId?: string;
  selectedObjectType?: string;
}

/** AI Memory - Session Layer */
export interface AISessionMemory {
  conversationId: string;
  messages: { role: 'user' | 'ai'; content: string; timestamp: string }[];
  currentScreen: string;
  startedAt: string;
}

/** AI Memory - Project Layer */
export interface AIProjectMemory {
  projectId: string;

  // Decisions & Rationale
  majorDecisions: {
    decisionId: string;
    title: string;
    outcome: string;
    rationale: string;
    recordedAt: string;
  }[];

  // Phase Transitions
  phaseTransitions: {
    from: string;
    to: string;
    reason: string;
    transitionedAt: string;
  }[];

  // AI Recommendations
  aiRecommendations: {
    recommendation: string;
    accepted: boolean;
    userFeedback?: string;
    recordedAt: string;
  }[];

  createdAt: string;
  updatedAt: string;
}

/** AI Memory - Organization Layer */
export interface AIOrganizationMemory {
  organizationId: string;

  governanceStyle: 'STRICT' | 'BALANCED' | 'FLEXIBLE';
  aiStrictnessPreference: 'MINIMAL' | 'STANDARD' | 'AGGRESSIVE';
  recurringPatterns: string[];

  createdAt: string;
  updatedAt: string;
}

/** AI User Preferences */
export interface AIUserPreferences {
  userId: string;

  preferredTone: 'BUDDY' | 'EXPERT' | 'MANAGER';
  educationModeEnabled: boolean;
  proactiveNotifications: boolean;
  preferredLanguage: string;

  createdAt: string;
  updatedAt: string;
}

/** AI Action Request */
export interface AIAction {
  id: string;
  type: AIActionType;

  // Context
  contextSnapshot: AIContext;
  projectId?: string;

  // Action Details
  payload: Record<string, unknown>;
  draftContent?: string;

  // Policy
  requiredPolicyLevel: AIPolicyLevel;
  currentPolicyLevel: AIPolicyLevel;
  requiresApproval: boolean;

  // Status
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED';

  // Audit
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  executedAt?: string;
}

/** AI Audit Entry */
export interface AIAuditEntry {
  id: string;
  userId: string;
  organizationId: string;
  projectId?: string;

  // Action
  actionType: string;
  actionDescription: string;

  // Context
  contextSnapshot: string; // JSON
  dataSourcesUsed: string[];

  // AI Details
  aiRole: AIRole;
  policyLevel: AIPolicyLevel;
  confidenceLevel?: number;

  // Result
  aiSuggestion: string;
  userDecision: 'ACCEPTED' | 'REJECTED' | 'MODIFIED' | 'IGNORED';
  userFeedback?: string;

  // Timestamp
  createdAt: string;
}

// ==========================================
// SCMS PHASE 1: CONTEXT (Why Change?)
// ==========================================

// Project Context: Captures the strategic "Why" behind transformation
export interface ProjectContext {
  projectId: string;

  // Business Context
  businessModel?: {
    type: string[]; // B2B, B2C, Marketplace
    description: string;
  };
  coreProcesses?: string[];
  itLandscape?: {
    erp?: string;
    crm?: string;
    integrationLevel?: 'Low' | 'Medium' | 'High';
  };

  // Strategic Intent
  strategicGoals: StrategicGoal[];
  successCriteria?: string;
  transformationHorizon?: '12m' | '24m' | '36m';

  // Constraints & Challenges
  challenges: Challenge[];
  constraints: Constraint[];

  // AI Analysis
  contextReadinessScore?: number; // 0-100
  contextGaps?: string[]; // AI-detected missing information
  isContextComplete?: boolean;

  updatedAt?: string;
}

// ==========================================
// SCMS PHASE 2: ASSESSMENT (Where are we now?)
// ==========================================

// Maturity Assessment: Captures As-Is vs To-Be state
export interface MaturityAssessment {
  id: string;
  projectId: string;

  // Per-Axis Scores
  axisScores: {
    axis: AxisId;
    asIs: number;      // 1-7
    toBe: number;      // 1-7
    gap: number;       // Calculated: toBe - asIs
    justification?: string;
    areaScores?: Record<string, number[]>; // Sub-area scores
  }[];

  // Overall
  overallAsIs?: number;
  overallToBe?: number;
  overallGap?: number;

  // AI Analysis
  gapAnalysisSummary?: string;
  prioritizedGaps?: string[];

  // Audit Trail
  completedAxes: AxisId[];
  isComplete?: boolean;
  createdAt: string;
  updatedAt: string;
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
  timezone?: string; // User timezone
  units?: 'metric' | 'imperial'; // User preference
  impersonatorId?: string; // ID of the admin impersonating this user
  licensePlanId?: string;
  hasWorkspace?: boolean; // NEW: Indicates if user already has an active workspace
  journeyState?: string; // Phase G/User Lifecycle State
  currentPhase?: string; // Phase A-G
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

export type StrategicIntent = 'Grow' | 'Fix' | 'Stabilize' | 'De-risk' | 'Build capability';

export interface StakeholderImpact {
  role: string; // e.g. "Sales Team"
  impact: 'Wins' | 'Loses' | 'Must Change';
  description: string;
}

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5' | 'Q6' | 'Q7' | 'Q8';
export type Wave = 'Wave 1' | 'Wave 2' | 'Wave 3';
// Updated InitiativeStatus to include Pilot-specific 'Validated' (Task) or Initiative status

export type TaskType = 'ANALYSIS' | 'DESIGN' | 'BUILD' | 'PILOT' | 'VALIDATION' | 'DECISION' | 'CHANGE_MGMT';

export interface DecisionImpact {
  decisionType: 'CONTINUE' | 'MOVE_TO_PILOT' | 'MOVE_TO_SCALE' | 'STOP' | 'APPROVE_INVESTMENT' | 'CHANGE_SCOPE';
  decisionStatement: string;
}

export interface TaskChangeLog {
  id: string;
  type: string;
  field: string;
  oldValue: any;
  newValue: any;
  changedBy: string;
  changedAt: string;
}

export interface AIInsight {
  strategicRelevance: 'HIGH' | 'MEDIUM' | 'LOW';
  executionRisk: 'HIGH' | 'MEDIUM' | 'LOW';
  clarityScore: number;
  summary: string;
  lastComputedAt: string;
}

export interface RiskRating {
  risk: string;
  mitigation: string;
  metric: 'Low' | 'Medium' | 'High';
}



// NEW: Pilot Result Struct
export interface PilotLearning {
  type: 'success' | 'failure' | 'surprise';
  insight: string;
  impact: string;
  actionable: string; // What we will do about it
}

// Module 5: Rollout Types
export interface RAIDItem {
  id: string;
  type: 'Risk' | 'Assumption' | 'Issue' | 'Dependency';
  title: string;
  description: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  probability?: 'High' | 'Medium' | 'Low'; // Only for Risks
  ownerId?: string;
  status: 'Open' | 'Mitigated' | 'Closed';
  dueDate?: string;
  linkedInitiativeId?: string;
  mitigationPlan?: string;
}

export interface KPITracking {
  id: string;
  name: string;
  baseline: number;
  target: number;
  current: number;
  unit: string;
  ownerId?: string;
  linkedInitiativeIds?: string[];
  history: { date: string; value: number }[];
}

export interface StakeholderMapItem {
  id: string;
  name: string;
  role: string;
  influence: 1 | 2 | 3 | 4 | 5;
  attitude: 'Supportive' | 'Neutral' | 'Resistant';
  engagementStrategy?: string;
}

export interface CommsPlanItem {
  id: string;
  message: string;
  audience: string;
  channel: string; // Email, Townhall, Slack...
  ownerId?: string;
  date: string;
  status: 'Draft' | 'Scheduled' | 'Sent';
}

export type CostRange = 'Low (<$10k)' | 'Medium ($10k-$50k)' | 'High (>$50k)';
export type BenefitRange = 'Low (<$20k/yr)' | 'Medium ($20k-$100k/yr)' | 'High (>$100k/yr)';

export interface Milestone {
  name: string;
  date: string;
  status: 'pending' | 'completed';
  isDecisionGate?: boolean;
  decision?: 'continue' | 'adjust' | 'stop';
  decisionRationale?: string;
}

export interface TargetState {
  process: string[];
  behavior: string[];
  capability: string[];
}

export interface StrategicChangeLog {
  id: string;
  date: string;
  user: string;
  change: string;
  reason: string;
  impact?: string;
}

export interface InitiativeAttachment {
  id: string;
  name: string;
  url: string;
  type: 'audit' | 'data' | 'strategy' | 'external';
  size?: number;
  uploadedAt: string;
  uploadedBy?: string;
}

export interface StrategicFit {
  axisAlign: boolean;
  goalAlign: boolean;
  painPointAlign: boolean;
  reasoning: string;
}

export interface DecisionReadinessBreakdown {
  strategic: boolean;
  problem: boolean;
  target: boolean;
  execution: boolean;
  value: boolean;
}

export interface ProblemStructured {
  symptom: string;
  rootCause: string;
  costOfInaction: string;
}

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
  applicantOneLiner?: string; // Executive One-Liner
  strategicIntent?: StrategicIntent;
  decisionReadiness?: number; // 0-100
  decisionReadinessBreakdown?: DecisionReadinessBreakdown; // New Task 8
  stakeholders?: StakeholderImpact[];

  // Pilot Specific Fields (Module 4)
  hypotheses?: string[]; // Mandatory for Pilot
  killCriteria?: string[]; // Mandatory for Pilot
  pilotRisks?: RiskRating[]; // Risks specific to pilot execution
  pilotLearnings?: PilotLearning[]; // Post-pilot evaluation

  hypothesis?: string; // Legacy singular
  businessValue?: 'High' | 'Medium' | 'Low';
  valueDriver?: 'Cost' | 'Revenue' | 'Capital' | 'Risk' | 'Capability';
  confidenceLevel?: 'High' | 'Medium' | 'Low';
  valueTiming?: 'Immediate' | 'Short term' | 'Long term';
  competenciesRequired?: string[];
  milestones?: Milestone[];
  // killCriteria?: string; // Removed legacy singular in favor of array above


  // Professional Card Fields
  problemStatement?: string;
  problemStructured?: ProblemStructured; // New Task 8

  targetState?: TargetState; // New Task 8
  decisionToMake?: string; // New Task 8
  decisionOwnerId?: string; // New Task 8
  strategicFit?: StrategicFit; // New Task 8
  attachments?: InitiativeAttachment[]; // New Task 8
  changeLog?: StrategicChangeLog[]; // New Task 8

  deliverables?: string[];

  successCriteria?: string[];
  scopeIn?: string[];
  scopeOut?: string[];
  keyRisks?: { risk: string; mitigation: string; metric: 'Low' | 'Medium' | 'High' }[];
  relatedGap?: string; // Links this initiative to a specific DRD Gap

  // Task 4: Scope Enhancements
  assumptions?: {
    org?: string;
    data?: string;
    budget?: string;
    people?: string;
  };
  structuredSuccessCriteria?: {
    type: 'Behavior' | 'Process' | 'Capability' | 'Metric';
    value: string;
  }[];

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

  // Strategic Portfolio Fields (New)
  aiConfidence?: 'High' | 'Medium' | 'Low'; // Green, Yellow, Red
  strategicGoalId?: string; // Link to StrategicGoal
  completenessScore?: number; // 0-100%
  valueStatement?: string; // Concise "Value" for preview

  // Initiative Intelligence (Task 7)
  lessonsLearned?: string; // What we learned
  strategicSurprises?: string; // What surprised us
  nextTimeAvoid?: string; // What we would do differently (avoid)
  patternTags?: string[]; // Cross-initiative patterns

  // DRD New Fields (Task 7 - Roadmap Enhancements)
  strategicRole?: 'Foundation' | 'Enabler' | 'Accelerator' | 'Scaling';
  effortProfile?: {
    analytical: number;
    operational: number;
    change: number;
    [key: string]: number; // index signature
  };
  placementReason?: string; // Why is this scheduled here?
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

// --- COMPOSABLE REPORTS (NEW) ---

export type BlockType = 'text' | 'table' | 'cards' | 'matrix' | 'evidence_list' | 'recommendation' | 'image' | 'callout';

export interface ReportSource {
  module: string;         // e.g. "ChallengeMap"
  entityId?: string;      // e.g. challengeId
  snapshotHash?: string;
}

export interface ReportBlockMeta {
  confidence?: number;
  tags?: string[];
  lastGeneratedBy?: string;
  lastEditedBy?: string;
  [key: string]: any;
}

export interface ReportBlock {
  id: string;
  reportId: string;
  type: BlockType;
  title?: string;
  module: string;
  anchor?: string;

  editable: boolean;
  aiRegeneratable: boolean;
  locked: boolean;

  content: any; // Type-specific content structure
  meta?: ReportBlockMeta;
  position: number;

  message?: string; // For callout
  level?: string;   // For callout
}

export interface Report {
  id: string;
  projectId?: string;
  organizationId: string;
  title: string;
  status: 'draft' | 'final' | 'archived';
  version: number;

  blockOrder: string[]; // List of block IDs
  blocks: Record<string, ReportBlock>; // Map for O(1) access

  sources?: ReportSource[];
  createdAt: string;
  updatedAt: string;
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
  areaScores?: Record<string, number[]>; // [actual, target] for each sub-area
  areaNotes?: Record<string, string>; // Notes justification for each sub-area
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

  // Module 5: Rollout Execution Data
  rollout?: {
    scope?: {
      programName: string;
      businessGoals: string[];
      inScope: string[];
      outScope: string[];
      strategicPillars: { title: string; description: string }[];
    };
    governance?: {
      roles: { role: string; personId?: string; responsibilities: string }[];
      workstreams: { id: string; name: string; ownerId?: string; members: string[] }[];
    };
    risks?: RAIDItem[];
    kpis?: KPITracking[];
    changeManagement?: {
      stakeholders: StakeholderMapItem[];
      commsPlan: CommsPlanItem[];
    };
    closure?: {
      checklist: { item: string; completed: boolean }[];
      lessonsLearned: { category: string; lesson: string; recommendation: string }[];
      isClosed: boolean;
      closedAt?: string;
    };
  };

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

  // Technical Conditions
  context_window?: number;
  max_outputs?: number; // Max output tokens
  description?: string;
  capabilities?: string[]; // e.g. "vision", "reasoning", "coding"
}

export type AIProviderType = 'system' | 'openai' | 'gemini' | 'ollama';

export interface AIProviderConfig {
  provider: AIProviderType;
  modelId: string;
  apiKey?: string;
  endpoint?: string;
  visibleModelIds?: string[];
  privateModels?: PrivateModel[]; // Using PrivateModel defined below
}

export interface UserAIConfig {
  provider?: AIProviderType; // Default/Active provider
  modelId?: string;          // Default/Active model ID
  endpoint?: string;         // Local endpoint
  apiKey?: string;           // Custom API Key (Legacy/Single)

  // New Multi-Model Config
  visibleModelIds?: string[]; // IDs of system models user wants to see
  privateModels?: PrivateModel[]; // User's custom models
}

export interface PrivateModel {
  id: string;
  name: string;
  provider: AIProviderType;
  apiKey?: string;
  endpoint?: string;
  modelId: string;
}

// ==========================================
// PHASE 1: TEAMWORK & COLLABORATION TYPES
// ==========================================

// Task Status (Workflow)
// Extended to include legacy aliases used in some components
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
// Task Status (Workflow)
// Extended to include legacy aliases used in some components
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
  projectId: string; // Keep for legacy, but might be empty if initiativeId is used
  organizationId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  progress?: number; // 0-100
  blockedReason?: string;
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

  // Strategic Execution Fields (Upgrade)
  taskType: TaskType;
  expectedOutcome?: string;
  decisionImpact?: DecisionImpact;
  evidenceRequired?: ('DOCUMENT' | 'DATA' | 'DEMO' | 'APPROVAL')[];
  evidenceItems?: { id: string; type: string; title: string; urlOrFileId: string; createdBy: string; createdAt: string }[];
  strategicContribution?: ('PROCESS_CHANGE' | 'BEHAVIOR_CHANGE' | 'CAPABILITY_CHANGE')[];

  // Dependencies
  dependencies?: {
    dependsOnTaskIds: string[];
    blocksTaskIds: string[];
  };

  // AI Insight
  aiInsight?: AIInsight;

  // Change Log
  changeLog?: TaskChangeLog[];

  // Legacy / Optional Mappings
  budgetAllocated?: number;
  budgetSpent?: number;
  riskRating?: RiskRating;
  acceptanceCriteria?: string;
  blockingIssues?: string;
  stepPhase?: 'design' | 'pilot' | 'rollout';
  initiativeId?: string;
  initiativeName?: string;
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
  isDemo?: boolean;
  impersonatorId?: string;
  tokenUsage?: number;
  tokenLimit?: number;
  tokenResetAt?: string;
  aiConfig?: AIProviderConfig;
  licensePlanId?: string;
  mfaEnabled?: boolean;
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

// Legacy Invitation types removed - see INVITATION SYSTEM section above for comprehensive types

// ==========================================
// LEGAL & COMPLIANCE
// ==========================================

/** Legal Document Types */
export type LegalDocType = 'TOS' | 'PRIVACY' | 'COOKIES' | 'AUP' | 'AI_POLICY' | 'DPA';

/** Legal Document (from legal_documents table) */
export interface LegalDocument {
  id: string;
  docType: LegalDocType;
  version: string;
  title: string;
  contentMd?: string;
  effectiveFrom: string;
  isActive: boolean;
  createdAt?: string;
  createdBy?: string;
}

/** Legal Acceptance Record */
export interface LegalAcceptance {
  id: string;
  docType: LegalDocType;
  version: string;
  acceptedAt: string;
  scope: 'USER' | 'ORG_ADMIN';
  organizationId?: string;
  userId: string;
}

/** Pending Legal Acceptances Response */
export interface PendingLegalDocs {
  required: LegalDocument[];
  dpaPending: boolean;
  dpaDoc?: LegalDocument;
  isOrgAdmin: boolean;
  hasAnyPending: boolean;
}

/** Legal Acceptance Status for Admin View */
export interface UserAcceptanceStatus {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  acceptanceStatus: Record<LegalDocType, {
    accepted: boolean;
    acceptedVersion?: string;
    currentVersion: string;
  }>;
}

// ==========================================
// STEP 13: VISUAL PLAYBOOK EDITOR TYPES
// ==========================================

/** Node types in playbook graph */
export enum PlaybookNodeType {
  START = 'START',
  ACTION = 'ACTION',
  BRANCH = 'BRANCH',
  CHECK = 'CHECK',
  END = 'END'
}

/** Single node in playbook graph */
export interface PlaybookNode {
  id: string;
  type: PlaybookNodeType;
  title: string;
  data: {
    actionType?: string;
    description?: string;
    payloadTemplate?: Record<string, unknown>;
    condition?: string;
    isOptional?: boolean;
    waitForPrevious?: boolean;
  };
  position: { x: number; y: number };
}

/** Edge connecting nodes in playbook graph */
export interface PlaybookEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

/** Complete playbook graph structure */
export interface TemplateGraph {
  nodes: PlaybookNode[];
  edges: PlaybookEdge[];
  meta: {
    trigger_signal: string;
  };
}

/** Template status enum */
export enum TemplateStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  DEPRECATED = 'DEPRECATED'
}

/** Playbook template with versioning */
export interface PlaybookTemplateVersion {
  id: string;
  key: string;
  title: string;
  description: string;
  triggerSignal: string;
  version: number;
  status: TemplateStatus;
  templateGraph: TemplateGraph | null;
  estimatedDurationMins: number;
  publishedAt?: string;
  publishedByUserId?: string;
  parentTemplateId?: string;
  isActive: boolean;
  createdAt?: string;
  steps?: PlaybookTemplateStep[];
}

/** Template step (for legacy linear format) */
export interface PlaybookTemplateStep {
  id: string;
  stepOrder: number;
  actionType: string;
  title: string;
  description?: string;
  payloadTemplate: Record<string, unknown>;
  isOptional: boolean;
  waitForPrevious: boolean;
}

/** Validation error from template validation */
export interface TemplateValidationError {
  code: string;
  message: string;
  nodeId?: string | null;
}

/** Validation result */
export interface TemplateValidationResult {
  ok: boolean;
  errors: TemplateValidationError[];
}

/** Export format for templates */
export interface PlaybookTemplateExport {
  exportVersion: string;
  exportedAt: string;
  template: {
    key: string;
    title: string;
    description: string;
    triggerSignal: string;
    estimatedDurationMins: number;
    templateGraph: TemplateGraph | null;
    steps?: PlaybookTemplateStep[];
  };
}
