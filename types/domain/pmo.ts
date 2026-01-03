/**
 * PMO Domain Types
 * Enterprise SaaS Architecture - PMO & Governance Types
 * 
 * Aligned with ISO 21500, PMBOK 7, PRINCE2 standards
 */

// ==========================================
// PMO CORE TYPES
// ==========================================

export type PMODomain =
    | 'scope'
    | 'schedule'
    | 'cost'
    | 'quality'
    | 'resource'
    | 'communication'
    | 'risk'
    | 'procurement'
    | 'stakeholder'
    | 'integration';

export type GovernanceLevel = 'portfolio' | 'program' | 'project';

export type ComplianceStandard = 'ISO21500' | 'PMBOK7' | 'PRINCE2' | 'IPMA' | 'custom';

/**
 * PMO Context for a project
 */
export interface PMOContext {
    projectId: string;
    organizationId: string;
    governanceLevel: GovernanceLevel;
    methodology: string;
    standards: ComplianceStandard[];
    currentPhase: ProjectPhase;
    gateStatus: GateStatus;
    healthScore: number;
    maturityLevel?: number;
    domains: PMODomainStatus[];
    blockingIssues: PMOIssue[];
    pendingDecisions: Decision[];
    upcomingMilestones: Milestone[];
    lastUpdated: string;
}

export interface PMODomainStatus {
    domain: PMODomain;
    status: 'green' | 'yellow' | 'red' | 'grey';
    score: number;
    issues: number;
    lastReviewed?: string;
}

// ==========================================
// PHASE & GATE TYPES
// ==========================================

import { ProjectPhase } from './project';

// ==========================================
// PHASE & GATE TYPES
// ==========================================

// ProjectPhase is imported from ./project

export type PMOIssue = Issue;

export type GateStatus = 'open' | 'blocked' | 'pending' | 'passed' | 'failed';

/**
 * Stage Gate / Phase Gate
 */
export interface StageGate {
    id: string;
    projectId: string;
    name: string;
    description?: string;
    phase: ProjectPhase;
    sequenceNumber: number;
    status: GateStatus;
    criteria: GateCriterion[];
    deliverables: GateDeliverable[];
    approvers: GateApprover[];
    scheduledDate?: string;
    actualDate?: string;
    outcome?: GateOutcome;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface GateCriterion {
    id: string;
    description: string;
    category: 'mandatory' | 'recommended' | 'informational';
    isMet: boolean;
    evidence?: string;
    verifiedBy?: string;
    verifiedAt?: string;
}

export interface GateDeliverable {
    id: string;
    name: string;
    description?: string;
    status: 'pending' | 'in_progress' | 'completed' | 'waived';
    documentUrl?: string;
    dueDate?: string;
    completedDate?: string;
}

export interface GateApprover {
    userId: string;
    userName: string;
    role: string;
    status: 'pending' | 'approved' | 'rejected' | 'abstained';
    decision?: string;
    decidedAt?: string;
}

export interface GateOutcome {
    decision: 'go' | 'no_go' | 'conditional_go' | 'hold';
    conditions?: string[];
    actionItems?: string[];
    nextReviewDate?: string;
    decidedAt: string;
    decidedBy: string;
}

// ==========================================
// DECISION TYPES
// ==========================================

export type DecisionStatus = 'pending' | 'approved' | 'rejected' | 'deferred' | 'escalated';

export type DecisionCategory =
    | 'scope_change'
    | 'budget_change'
    | 'schedule_change'
    | 'resource_allocation'
    | 'risk_response'
    | 'procurement'
    | 'quality'
    | 'stakeholder'
    | 'technical'
    | 'strategic';

/**
 * Decision record
 */
export interface Decision {
    id: string;
    projectId: string;
    title: string;
    description: string;
    category: DecisionCategory;
    pmoDomain: PMODomain;
    status: DecisionStatus;
    priority: 'low' | 'medium' | 'high' | 'critical';
    requestedBy: string;
    requestedByName?: string;
    requestedAt: string;
    dueDate?: string;
    deciderId?: string;
    deciderName?: string;
    decisionDate?: string;
    rationale?: string;
    impact?: DecisionImpact;
    alternatives?: DecisionAlternative[];
    attachments?: string[];
    linkedIssues?: string[];
    linkedRisks?: string[];
    escalatedTo?: string;
    escalatedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface DecisionImpact {
    scope: 'low' | 'medium' | 'high';
    schedule: 'low' | 'medium' | 'high';
    cost: 'low' | 'medium' | 'high';
    quality: 'low' | 'medium' | 'high';
    description?: string;
}

export interface DecisionAlternative {
    id: string;
    title: string;
    description: string;
    pros?: string[];
    cons?: string[];
    estimatedCost?: number;
    estimatedDuration?: string;
    isRecommended?: boolean;
}

// ==========================================
// RAID TYPES (Risks, Assumptions, Issues, Dependencies)
// ==========================================

export type RAIDType = 'risk' | 'assumption' | 'issue' | 'dependency';

export type RAIDStatus = 'open' | 'in_progress' | 'mitigated' | 'closed' | 'accepted';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * RAID item (base)
 */
export interface RAIDItem {
    id: string;
    projectId: string;
    type: RAIDType;
    title: string;
    description: string;
    status: RAIDStatus;
    severity: RiskSeverity;
    pmoDomain?: PMODomain;
    owner?: string;
    ownerName?: string;
    dueDate?: string;
    resolvedDate?: string;
    resolution?: string;
    linkedDecisions?: string[];
    linkedTasks?: string[];
    attachments?: string[];
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * Risk (extends RAID)
 */
export interface Risk extends RAIDItem {
    type: 'risk';
    category?: RiskCategory;
    probability: number; // 1-5 or 0-100
    impact: number; // 1-5 or 0-100
    riskScore?: number;
    riskResponse?: RiskResponse;
    triggers?: string[];
    mitigationPlan?: string;
    contingencyPlan?: string;
    fallbackPlan?: string;
    residualRisk?: number;
    reviewDate?: string;
}

export type RiskCategory =
    | 'technical'
    | 'schedule'
    | 'cost'
    | 'resource'
    | 'external'
    | 'organizational'
    | 'quality'
    | 'security'
    | 'compliance';

export type RiskResponse =
    | 'avoid'
    | 'mitigate'
    | 'transfer'
    | 'accept'
    | 'exploit'
    | 'enhance'
    | 'share';

/**
 * Issue (extends RAID)
 */
export interface Issue extends RAIDItem {
    type: 'issue';
    category?: IssueCategory;
    rootCause?: string;
    impactDescription?: string;
    workaround?: string;
    escalationLevel?: number;
    escalatedTo?: string;
    escalatedAt?: string;
}

export type IssueCategory =
    | 'blocker'
    | 'impediment'
    | 'defect'
    | 'change_request'
    | 'resource_constraint'
    | 'external_dependency'
    | 'communication';

/**
 * Dependency (extends RAID)
 */
export interface Dependency extends RAIDItem {
    type: 'dependency';
    dependencyType: DependencyType;
    sourceId?: string;
    sourceName?: string;
    targetId?: string;
    targetName?: string;
    externalParty?: string;
    expectedDeliveryDate?: string;
    actualDeliveryDate?: string;
    lag?: number;
}

export type DependencyType =
    | 'finish_to_start'
    | 'start_to_start'
    | 'finish_to_finish'
    | 'start_to_finish'
    | 'external'
    | 'internal';

/**
 * Assumption (extends RAID)
 */
export interface Assumption extends RAIDItem {
    type: 'assumption';
    validationCriteria?: string;
    validationStatus?: 'unvalidated' | 'validated' | 'invalid';
    validatedAt?: string;
    validatedBy?: string;
    impactIfInvalid?: string;
}

// ==========================================
// MILESTONE TYPES
// ==========================================

export type MilestoneStatus = 'pending' | 'on_track' | 'at_risk' | 'completed' | 'missed' | 'cancelled';

/**
 * Project milestone
 */
export interface Milestone {
    id: string;
    projectId: string;
    name: string;
    description?: string;
    status: MilestoneStatus;
    phase?: ProjectPhase;
    dueDate: string;
    completedDate?: string;
    owner?: string;
    ownerName?: string;
    deliverables?: string[];
    linkedTasks?: string[];
    linkedInitiatives?: string[];
    linkedGates?: string[];
    dependencies?: string[];
    isKeyMilestone: boolean;
    isClientFacing: boolean;
    variance?: number; // days
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

// ==========================================
// CHANGE CONTROL TYPES
// ==========================================

export type ChangeRequestStatus =
    | 'draft'
    | 'submitted'
    | 'under_review'
    | 'approved'
    | 'rejected'
    | 'implemented'
    | 'withdrawn';

export type ChangeRequestType =
    | 'scope'
    | 'schedule'
    | 'cost'
    | 'resource'
    | 'quality'
    | 'requirements'
    | 'design';

/**
 * Change request
 */
export interface ChangeRequest {
    id: string;
    projectId: string;
    title: string;
    description: string;
    type: ChangeRequestType;
    status: ChangeRequestStatus;
    priority: 'low' | 'medium' | 'high' | 'critical';
    requestedBy: string;
    requestedByName?: string;
    requestedAt: string;
    justification: string;
    impact: ChangeImpact;
    implementation?: ChangeImplementation;
    review?: ChangeReview;
    linkedDecisions?: string[];
    linkedIssues?: string[];
    attachments?: string[];
    createdAt: string;
    updatedAt: string;
}

export interface ChangeImpact {
    scopeImpact: string;
    scheduleImpact: string;
    costImpact: number;
    qualityImpact: string;
    riskImpact: string;
    resourceImpact: string;
    overallAssessment: 'minimal' | 'moderate' | 'significant' | 'major';
}

export interface ChangeImplementation {
    plan: string;
    startDate?: string;
    endDate?: string;
    responsibleParty: string;
    status: 'not_started' | 'in_progress' | 'completed';
    completedAt?: string;
}

export interface ChangeReview {
    reviewers: ChangeReviewer[];
    ccbDate?: string; // Change Control Board meeting date
    decision?: 'approved' | 'rejected' | 'deferred' | 'more_info_needed';
    decisionDate?: string;
    conditions?: string[];
    comments?: string;
}

export interface ChangeReviewer {
    userId: string;
    userName: string;
    role: string;
    vote?: 'approve' | 'reject' | 'abstain';
    comments?: string;
    votedAt?: string;
}

// ==========================================
// REPORT TYPES
// ==========================================

export type ReportType =
    | 'status'
    | 'progress'
    | 'risk'
    | 'financial'
    | 'resource'
    | 'quality'
    | 'executive_summary'
    | 'lessons_learned'
    | 'closure';

export type ReportFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'ad_hoc';

/**
 * PMO Report
 */
export interface PMOReport {
    id: string;
    projectId: string;
    type: ReportType;
    title: string;
    period: {
        start: string;
        end: string;
    };
    status: 'draft' | 'published' | 'archived';
    content: ReportContent;
    generatedBy: 'manual' | 'automated' | 'ai';
    createdBy: string;
    createdAt: string;
    publishedAt?: string;
    recipients?: string[];
    attachments?: string[];
}

export interface ReportContent {
    summary?: string;
    highlights?: string[];
    concerns?: string[];
    healthStatus?: {
        overall: 'green' | 'yellow' | 'red';
        schedule: 'green' | 'yellow' | 'red';
        budget: 'green' | 'yellow' | 'red';
        scope: 'green' | 'yellow' | 'red';
        quality: 'green' | 'yellow' | 'red';
    };
    metrics?: ReportMetric[];
    milestones?: MilestoneStatus[];
    risks?: RiskSummary[];
    issues?: IssueSummary[];
    nextSteps?: string[];
    customSections?: ReportSection[];
}

export interface ReportMetric {
    name: string;
    value: number | string;
    target?: number | string;
    trend?: 'up' | 'down' | 'stable';
    status?: 'on_track' | 'at_risk' | 'off_track';
}

export interface RiskSummary {
    id: string;
    title: string;
    severity: RiskSeverity;
    status: RAIDStatus;
    trend?: 'increasing' | 'decreasing' | 'stable';
}

export interface IssueSummary {
    id: string;
    title: string;
    severity: RiskSeverity;
    status: RAIDStatus;
    daysOpen: number;
}

export interface ReportSection {
    title: string;
    content: string;
    order: number;
}

// ==========================================
// LESSONS LEARNED TYPES
// ==========================================

export type LessonCategory =
    | 'process'
    | 'technical'
    | 'communication'
    | 'resource'
    | 'vendor'
    | 'stakeholder'
    | 'risk'
    | 'success';

/**
 * Lesson learned entry
 */
export interface LessonLearned {
    id: string;
    projectId: string;
    title: string;
    description: string;
    category: LessonCategory;
    type: 'success' | 'improvement' | 'failure';
    phase?: ProjectPhase;
    pmoDomain?: PMODomain;
    impact: 'low' | 'medium' | 'high';
    recommendations: string[];
    applicableTo?: string[];
    tags?: string[];
    submittedBy: string;
    submittedAt: string;
    reviewedBy?: string;
    reviewedAt?: string;
    isApproved: boolean;
    createdAt: string;
    updatedAt: string;
}

// ==========================================
// COMPLIANCE TYPES
// ==========================================

/**
 * Compliance check result
 */
export interface ComplianceCheck {
    id: string;
    projectId: string;
    standard: ComplianceStandard;
    domain: PMODomain;
    checkName: string;
    description: string;
    status: 'compliant' | 'non_compliant' | 'partially_compliant' | 'not_applicable';
    evidence?: string;
    findings?: string;
    recommendations?: string[];
    checkedBy: string;
    checkedAt: string;
}

/**
 * Compliance report
 */
export interface ComplianceReport {
    id: string;
    projectId: string;
    standards: ComplianceStandard[];
    overallScore: number;
    checks: ComplianceCheck[];
    summary: string;
    gaps: ComplianceGap[];
    actionPlan?: ComplianceAction[];
    generatedAt: string;
    generatedBy: string;
}

export interface ComplianceGap {
    standard: ComplianceStandard;
    domain: PMODomain;
    description: string;
    severity: 'minor' | 'major' | 'critical';
    recommendation: string;
}

export interface ComplianceAction {
    id: string;
    gapId: string;
    action: string;
    owner: string;
    dueDate: string;
    status: 'pending' | 'in_progress' | 'completed';
}


