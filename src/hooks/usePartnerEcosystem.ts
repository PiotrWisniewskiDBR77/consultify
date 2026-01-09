/**
 * usePartnerEcosystem Hook
 *
 * Manages partner ecosystem data with PMO standards compliance
 * Aligned with ISO 21500 / PMBOK 7 / PRINCE2
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Api } from '@/services/api';
import {
    AcademyModule,
    ClientAccess,
    CommissionStatement,
    DirectoryProfile,
    EmployeeAccess,
    PARTNER_PMO_MAPPING,
    PARTNER_TRUST_PHASES,
    PartnerCertification,
    PartnerDeal,
    PartnerEcosystemMetrics,
    PartnerTrustPhase,
    PartnerTrustProgression,
    PMOStandardsMapping,
} from '../views/partner/types';

// =============================================================================
// MOCK DATA (Replace with API calls in production)
// =============================================================================

const MOCK_ECOSYSTEM_METRICS: PartnerEcosystemMetrics = {
    referralConversions: 12,
    benchmarkContributions: 8,
    networkEffectMultiplier: 1.4,
    ecosystemHealthScore: 87,
    totalDealsCreated: 24,
    totalDealsWon: 8,
    totalCommissionEarned: 58400,
    activeClients: 6,
    partnerTier: 'GOLD',
};

const MOCK_DEALS: PartnerDeal[] = [
    {
        id: 'deal-001',
        partnerId: 'partner-001',
        clientName: 'DigitalFinance Inc.',
        dealValue: 125000,
        status: 'WON',
        commissionRate: 10,
        commissionAmount: 12500,
        registeredAt: '2025-10-15T10:00:00Z',
        closedAt: '2025-12-01T14:30:00Z',
        pmoMapping: PARTNER_PMO_MAPPING.DEAL_REGISTRATION,
    },
    {
        id: 'deal-002',
        partnerId: 'partner-001',
        clientName: 'Nordic Energy',
        dealValue: 85000,
        status: 'NEGOTIATION',
        commissionRate: 10,
        commissionAmount: 8500,
        registeredAt: '2025-11-20T09:00:00Z',
        pmoMapping: PARTNER_PMO_MAPPING.DEAL_REGISTRATION,
    },
    {
        id: 'deal-003',
        partnerId: 'partner-001',
        clientName: 'TechStartup AG',
        dealValue: 45000,
        status: 'QUALIFIED',
        commissionRate: 12,
        commissionAmount: 5400,
        registeredAt: '2025-12-10T11:00:00Z',
        pmoMapping: PARTNER_PMO_MAPPING.DEAL_REGISTRATION,
    },
];

const MOCK_STATEMENTS: CommissionStatement[] = [
    {
        id: 'stmt-001',
        partnerId: 'partner-001',
        period: 'Q4 2025',
        totalAmount: 12450,
        status: 'PENDING',
        deals: [MOCK_DEALS[0]],
    },
    {
        id: 'stmt-002',
        partnerId: 'partner-001',
        period: 'Q3 2025',
        totalAmount: 9250,
        status: 'PAID',
        deals: [],
        paidAt: '2025-10-15T10:00:00Z',
        paymentReference: 'PAY-2025-Q3-001',
    },
];

const MOCK_ACADEMY_MODULES: AcademyModule[] = [
    {
        id: 'mod-001',
        title: 'Consultinity Methodology Fundamentals',
        description: 'Podstawy metodologii DRD i Meta-PMO Framework',
        duration: '45 min',
        category: 'METHODOLOGY',
        requiredForCertification: true,
        completedAt: '2025-11-01T10:00:00Z',
        score: 92,
    },
    {
        id: 'mod-002',
        title: 'Co-Selling Best Practices',
        description: 'Techniki wspólnej sprzedaży i deal registration',
        duration: '30 min',
        category: 'SALES',
        requiredForCertification: true,
    },
    {
        id: 'mod-003',
        title: 'PMO Standards Compliance',
        description: 'ISO 21500, PMBOK 7, PRINCE2 w kontekście partnerskim',
        duration: '60 min',
        category: 'COMPLIANCE',
        requiredForCertification: true,
    },
    {
        id: 'mod-004',
        title: 'Enterprise Integration Patterns',
        description: 'Zaawansowane scenariusze integracji z klientami enterprise',
        duration: '40 min',
        category: 'TECHNICAL',
        requiredForCertification: false,
    },
];

const MOCK_CLIENTS: ClientAccess[] = [
    {
        id: 'client-001',
        clientId: 'org-001',
        clientName: 'DigitalFinance Inc.',
        region: 'EMEA',
        status: 'ACTIVE',
        accessLevel: 'ADMIN',
        grantedAt: '2025-10-20T10:00:00Z',
    },
    {
        id: 'client-002',
        clientId: 'org-002',
        clientName: 'Nordic Energy',
        region: 'EMEA',
        status: 'PENDING',
        accessLevel: 'EDITOR',
    },
];

const MOCK_EMPLOYEES: EmployeeAccess[] = [
    {
        id: 'emp-001',
        employeeId: 'user-001',
        employeeName: 'Aleksandra Markiewicz',
        email: 'a.markiewicz@partner.com',
        status: 'ACTIVE',
        accessType: 'CLIENT_ADMIN',
        clients: ['org-001', 'org-002'],
    },
    {
        id: 'emp-002',
        employeeId: 'user-002',
        employeeName: 'Agata Zaguła',
        email: 'a.zagula@partner.com',
        status: 'DEACTIVATED',
        accessType: 'DEAL_MANAGER',
        clients: [],
    },
];

const MOCK_DIRECTORY_PROFILE: DirectoryProfile = {
    id: 'profile-001',
    partnerId: 'partner-001',
    companyName: 'Consultinity Partner Solutions',
    description:
        'Specjalizujemy się w transformacji cyfrowej i wdrożeniach enterprise dla średnich i dużych organizacji.',
    companySize: '11-50',
    regions: ['EMEA', 'APAC'],
    languages: ['English', 'Polish', 'German'],
    industries: ['Finance', 'Energy', 'Manufacturing'],
    services: ['Digital Transformation', 'PMO Setup', 'Change Management', 'AI Implementation'],
    budgetRange: { min: 50000, max: 500000, currency: 'EUR' },
    certifications: ['CONSULTINITY_CERTIFIED', 'ISO_27001'],
    reviews: [
        {
            id: 'rev-001',
            clientName: 'DigitalFinance Inc.',
            rating: 5,
            comment: 'Excellent partnership and delivery quality.',
            createdAt: '2025-11-15T10:00:00Z',
            verified: true,
        },
    ],
    rating: 4.8,
    isPublished: true,
};

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

interface UsePartnerEcosystemReturn {
    // Data
    metrics: PartnerEcosystemMetrics | null;
    deals: PartnerDeal[];
    statements: CommissionStatement[];
    academyModules: AcademyModule[];
    certifications: PartnerCertification[];
    clients: ClientAccess[];
    employees: EmployeeAccess[];
    directoryProfile: DirectoryProfile | null;
    trustProgression: PartnerTrustProgression[];
    currentTrustPhase: PartnerTrustPhase;

    // Loading states
    loading: boolean;
    error: string | null;

    // Actions
    refreshMetrics: () => Promise<void>;
    registerDeal: (deal: Partial<PartnerDeal>) => Promise<PartnerDeal>;
    submitCommissionInquiry: (type: string, message: string) => Promise<void>;
    updateDirectoryProfile: (profile: Partial<DirectoryProfile>) => Promise<void>;
    completeAcademyModule: (moduleId: string, score: number) => Promise<void>;
    requestClientAccess: (clientId: string, accessLevel: string) => Promise<void>;

    // PMO Compliance
    getPMOMapping: (actionType: string) => PMOStandardsMapping | null;
    getComplianceScore: () => number;
}

export function usePartnerEcosystem(): UsePartnerEcosystemReturn {
    const [metrics, setMetrics] = useState<PartnerEcosystemMetrics | null>(null);
    const [deals, setDeals] = useState<PartnerDeal[]>([]);
    const [statements, setStatements] = useState<CommissionStatement[]>([]);
    const [academyModules, setAcademyModules] = useState<AcademyModule[]>([]);
    const [certifications, setCertifications] = useState<PartnerCertification[]>([]);
    const [clients, setClients] = useState<ClientAccess[]>([]);
    const [employees, setEmployees] = useState<EmployeeAccess[]>([]);
    const [directoryProfile, setDirectoryProfile] = useState<DirectoryProfile | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Calculate current trust phase based on completed requirements
    const currentTrustPhase = useMemo<PartnerTrustPhase>(() => {
        const completedModules = academyModules.filter((m) => m.completedAt).length;
        const hasDeals = deals.length > 0;
        const hasClients = clients.filter((c) => c.status === 'ACTIVE').length > 0;
        const hasProfile = directoryProfile?.isPublished;

        if (hasClients && hasDeals && completedModules >= 2) return 'G5_ECOSYSTEM';
        if (hasDeals || hasClients) return 'G4_ACTIVATION';
        if (hasProfile && completedModules >= 1) return 'G3_ONBOARDING';
        if (completedModules >= 1) return 'G2_QUALIFICATION';
        return 'G1_DISCOVERY';
    }, [academyModules, deals, clients, directoryProfile]);

    // Trust progression with completion status
    const trustProgression = useMemo<PartnerTrustProgression[]>(() => {
        const phaseOrder: PartnerTrustPhase[] = [
            'G1_DISCOVERY',
            'G2_QUALIFICATION',
            'G3_ONBOARDING',
            'G4_ACTIVATION',
            'G5_ECOSYSTEM',
        ];
        const currentIndex = phaseOrder.indexOf(currentTrustPhase);

        return PARTNER_TRUST_PHASES.map((phase, index) => ({
            ...phase,
            completedAt: index < currentIndex ? new Date().toISOString() : undefined,
        }));
    }, [currentTrustPhase]);

    // Initial data fetch
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // In production, replace with actual API calls
            // const response = await Api.getPartnerEcosystem();

            // Mock data for now
            await new Promise((resolve) => setTimeout(resolve, 500));

            setMetrics(MOCK_ECOSYSTEM_METRICS);
            setDeals(MOCK_DEALS);
            setStatements(MOCK_STATEMENTS);
            setAcademyModules(MOCK_ACADEMY_MODULES);
            setClients(MOCK_CLIENTS);
            setEmployees(MOCK_EMPLOYEES);
            setDirectoryProfile(MOCK_DIRECTORY_PROFILE);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load partner data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Actions
    const refreshMetrics = useCallback(async () => {
        await fetchData();
    }, [fetchData]);

    const registerDeal = useCallback(async (deal: Partial<PartnerDeal>): Promise<PartnerDeal> => {
        // In production: await Api.registerPartnerDeal(deal);
        const newDeal: PartnerDeal = {
            id: `deal-${Date.now()}`,
            partnerId: 'partner-001',
            clientName: deal.clientName || 'New Client',
            dealValue: deal.dealValue || 0,
            status: 'REGISTERED',
            commissionRate: 10,
            commissionAmount: (deal.dealValue || 0) * 0.1,
            registeredAt: new Date().toISOString(),
            pmoMapping: PARTNER_PMO_MAPPING.DEAL_REGISTRATION,
        };

        setDeals((prev) => [...prev, newDeal]);
        return newDeal;
    }, []);

    const submitCommissionInquiry = useCallback(async (type: string, message: string): Promise<void> => {
        // In production: await Api.submitCommissionInquiry({ type, message });
        console.log('[Partner] Commission inquiry submitted:', { type, message });
    }, []);

    const updateDirectoryProfile = useCallback(async (profile: Partial<DirectoryProfile>): Promise<void> => {
        // In production: await Api.updateDirectoryProfile(profile);
        setDirectoryProfile((prev) => (prev ? { ...prev, ...profile } : null));
    }, []);

    const completeAcademyModule = useCallback(async (moduleId: string, score: number): Promise<void> => {
        // In production: await Api.completeAcademyModule(moduleId, score);
        setAcademyModules((prev) =>
            prev.map((m) => (m.id === moduleId ? { ...m, completedAt: new Date().toISOString(), score } : m)),
        );
    }, []);

    const requestClientAccess = useCallback(async (clientId: string, accessLevel: string): Promise<void> => {
        // In production: await Api.requestClientAccess(clientId, accessLevel);
        console.log('[Partner] Client access requested:', { clientId, accessLevel });
    }, []);

    // PMO Compliance helpers
    const getPMOMapping = useCallback((actionType: string): PMOStandardsMapping | null => {
        return PARTNER_PMO_MAPPING[actionType] || null;
    }, []);

    const getComplianceScore = useCallback((): number => {
        // Calculate compliance score based on various factors
        let score = 0;
        const maxScore = 100;

        // Directory profile completeness (25 points)
        if (directoryProfile) {
            if (directoryProfile.isPublished) score += 10;
            if (directoryProfile.description.length > 100) score += 5;
            if (directoryProfile.services.length >= 3) score += 5;
            if (directoryProfile.certifications.length >= 1) score += 5;
        }

        // Academy completion (25 points)
        const requiredModules = academyModules.filter((m) => m.requiredForCertification);
        const completedRequired = requiredModules.filter((m) => m.completedAt).length;
        score += Math.round((completedRequired / Math.max(requiredModules.length, 1)) * 25);

        // Deal activity (25 points)
        if (deals.length > 0) score += 10;
        if (deals.filter((d) => d.status === 'WON').length > 0) score += 15;

        // Client management (25 points)
        if (clients.filter((c) => c.status === 'ACTIVE').length > 0) score += 15;
        if (employees.filter((e) => e.status === 'ACTIVE').length > 0) score += 10;

        return Math.min(score, maxScore);
    }, [directoryProfile, academyModules, deals, clients, employees]);

    return {
        metrics,
        deals,
        statements,
        academyModules,
        certifications,
        clients,
        employees,
        directoryProfile,
        trustProgression,
        currentTrustPhase,
        loading,
        error,
        refreshMetrics,
        registerDeal,
        submitCommissionInquiry,
        updateDirectoryProfile,
        completeAcademyModule,
        requestClientAccess,
        getPMOMapping,
        getComplianceScore,
    };
}

export default usePartnerEcosystem;
