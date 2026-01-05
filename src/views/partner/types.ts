/**
 * Partner Module Types
 *
 * Defines types for the Partner Portal with PMO Standards Compliance
 * Aligned with ISO 21500 / PMBOK 7 / PRINCE2
 */

// =============================================================================
// PMO STANDARDS MAPPING
// =============================================================================

export type PMODomainId =
    | 'GOVERNANCE_DECISION_MAKING'
    | 'SCOPE_CHANGE_CONTROL'
    | 'SCHEDULE_MILESTONES'
    | 'RISK_ISSUE_MANAGEMENT'
    | 'RESOURCE_RESPONSIBILITY'
    | 'PERFORMANCE_MONITORING'
    | 'BENEFITS_REALIZATION';

export interface PMOStandardsMapping {
    domain: PMODomainId;
    iso21500: string;
    pmbok: string;
    prince2: string;
}

export const PARTNER_PMO_MAPPING: Record<string, PMOStandardsMapping> = {
    DEAL_REGISTRATION: {
        domain: 'GOVERNANCE_DECISION_MAKING',
        iso21500: 'Governance Decision (Clause 4.3.4)',
        pmbok: 'Project Decision / Authorization',
        prince2: 'Project Board Decision',
    },
    COMMISSION_SETTLEMENT: {
        domain: 'BENEFITS_REALIZATION',
        iso21500: 'Benefits Identification (Clause 4.4.1)',
        pmbok: 'Benefits Documentation',
        prince2: 'Expected Benefits (Business Case)',
    },
    CLIENT_ACCESS_MANAGEMENT: {
        domain: 'RESOURCE_RESPONSIBILITY',
        iso21500: 'Resource Subject Group (Clause 4.6)',
        pmbok: 'Team Performance Domain',
        prince2: 'Organization Theme',
    },
    PARTNER_ONBOARDING: {
        domain: 'SCOPE_CHANGE_CONTROL',
        iso21500: 'Scope Subject Group (Clause 4.4)',
        pmbok: 'Development Approach & Life Cycle',
        prince2: 'Change Theme',
    },
    DIRECTORY_PROFILE: {
        domain: 'PERFORMANCE_MONITORING',
        iso21500: 'Project Performance Measurement (Clause 4.4.22)',
        pmbok: 'Project Performance Information',
        prince2: 'Highlight Report',
    },
    RESOURCE_ACCESS: {
        domain: 'RESOURCE_RESPONSIBILITY',
        iso21500: 'Resource Subject Group (Clause 4.6)',
        pmbok: 'Team Performance Domain',
        prince2: 'Organization Theme',
    },
};

// =============================================================================
// TRUST PROGRESSION MODEL
// =============================================================================

export type PartnerTrustPhase =
    | 'G1_DISCOVERY'
    | 'G2_QUALIFICATION'
    | 'G3_ONBOARDING'
    | 'G4_ACTIVATION'
    | 'G5_ECOSYSTEM';

export interface PartnerTrustProgression {
    phase: PartnerTrustPhase;
    label: string;
    description: string;
    requirements: string[];
    completedAt?: string;
}

export const PARTNER_TRUST_PHASES: PartnerTrustProgression[] = [
    {
        phase: 'G1_DISCOVERY',
        label: 'Discovery',
        description: 'Zapoznanie z programem partnerskim',
        requirements: ['Wizyta na landing page', 'Przeglądanie benefitów'],
    },
    {
        phase: 'G2_QUALIFICATION',
        label: 'Qualification',
        description: 'Weryfikacja i academy readiness',
        requirements: ['Provider Home', 'Academy modules', 'Verification tax/bank'],
    },
    {
        phase: 'G3_ONBOARDING',
        label: 'Onboarding',
        description: 'Agreement i Directory Profile',
        requirements: ['Partner agreement', 'Directory profile', 'Co-sell setup'],
    },
    {
        phase: 'G4_ACTIVATION',
        label: 'Activation',
        description: 'Client Access i Commission',
        requirements: ['First deal registration', 'Client access management', 'Commission setup'],
    },
    {
        phase: 'G5_ECOSYSTEM',
        label: 'Ecosystem Participation',
        description: 'Referrals i Benchmarks',
        requirements: ['Referral program', 'Benchmark contributions', 'Community engagement'],
    },
];

// =============================================================================
// PARTNER ECOSYSTEM ROLES
// =============================================================================

export type PartnerEcosystemRole = 'PARTNER_ADMIN' | 'PARTNER_MANAGER' | 'PARTNER_USER' | 'PARTNER_CONSULTANT';

export interface PartnerRoleDefinition {
    role: PartnerEcosystemRole;
    label: string;
    description: string;
    permissions: string[];
}

export const PARTNER_ROLES: PartnerRoleDefinition[] = [
    {
        role: 'PARTNER_ADMIN',
        label: 'Partner Admin',
        description: 'Full partner management access',
        permissions: ['manage_deals', 'manage_clients', 'manage_commission', 'manage_team', 'view_analytics'],
    },
    {
        role: 'PARTNER_MANAGER',
        label: 'Partner Manager',
        description: 'Deal registration & client access',
        permissions: ['manage_deals', 'manage_clients', 'view_commission', 'view_analytics'],
    },
    {
        role: 'PARTNER_USER',
        label: 'Partner User',
        description: 'Commission viewing & resources',
        permissions: ['view_deals', 'view_commission', 'access_resources'],
    },
    {
        role: 'PARTNER_CONSULTANT',
        label: 'Partner Consultant',
        description: 'Limited advisory access',
        permissions: ['view_deals', 'access_resources'],
    },
];

// =============================================================================
// ECOSYSTEM METRICS
// =============================================================================

export interface PartnerEcosystemMetrics {
    referralConversions: number;
    benchmarkContributions: number;
    networkEffectMultiplier: number;
    ecosystemHealthScore: number;
    totalDealsCreated: number;
    totalDealsWon: number;
    totalCommissionEarned: number;
    activeClients: number;
    partnerTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
}

export interface PartnerDeal {
    id: string;
    partnerId: string;
    clientName: string;
    clientOrganizationId?: string;
    dealValue: number;
    status: 'REGISTERED' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST';
    commissionRate: number;
    commissionAmount: number;
    registeredAt: string;
    closedAt?: string;
    pmoMapping: PMOStandardsMapping;
}

export interface CommissionStatement {
    id: string;
    partnerId: string;
    period: string;
    totalAmount: number;
    status: 'PENDING' | 'APPROVED' | 'PAID';
    deals: PartnerDeal[];
    paidAt?: string;
    paymentReference?: string;
}

// =============================================================================
// VALUE HYPOTHESIS INTEGRATION
// =============================================================================

export interface PartnerDealValueHypothesis {
    dealId: string;
    partnerId: string;
    clientOrganizationId: string;
    valueHypothesis: {
        expectedRevenue: number;
        implementationTimeline: string;
        successMetrics: string[];
        riskFactors: string[];
    };
    standardsMapping: PMOStandardsMapping;
}

// =============================================================================
// ACADEMY & CERTIFICATION
// =============================================================================

export interface AcademyModule {
    id: string;
    title: string;
    description: string;
    duration: string;
    category: 'METHODOLOGY' | 'SALES' | 'TECHNICAL' | 'COMPLIANCE';
    requiredForCertification: boolean;
    completedAt?: string;
    score?: number;
}

export interface PartnerCertification {
    id: string;
    partnerId: string;
    type: 'CONSULTIFY_CERTIFIED' | 'CO_SELL_EXPERT' | 'ENTERPRISE_PARTNER';
    earnedAt: string;
    expiresAt: string;
    modulesCompleted: string[];
}

// =============================================================================
// CLIENT ACCESS
// =============================================================================

export interface ClientAccess {
    id: string;
    clientId: string;
    clientName: string;
    region: string;
    status: 'PENDING' | 'ACTIVE' | 'REVOKED';
    accessLevel: 'VIEWER' | 'EDITOR' | 'ADMIN';
    grantedAt?: string;
    grantedBy?: string;
}

export interface EmployeeAccess {
    id: string;
    employeeId: string;
    employeeName: string;
    email: string;
    status: 'ACTIVE' | 'DEACTIVATED';
    accessType: 'CLIENT_ADMIN' | 'CLIENT_USER' | 'DEAL_MANAGER';
    clients: string[];
}

// =============================================================================
// DIRECTORY PROFILE
// =============================================================================

export interface DirectoryProfile {
    id: string;
    partnerId: string;
    companyName: string;
    description: string;
    logo?: string;
    website?: string;
    companySize: '1-10' | '11-50' | '51-200' | '201-500' | '500+';
    regions: string[];
    languages: string[];
    industries: string[];
    services: string[];
    budgetRange: {
        min: number;
        max: number;
        currency: string;
    };
    certifications: string[];
    reviews: DirectoryReview[];
    rating: number;
    isPublished: boolean;
}

export interface DirectoryReview {
    id: string;
    clientName: string;
    rating: number;
    comment: string;
    createdAt: string;
    verified: boolean;
}
