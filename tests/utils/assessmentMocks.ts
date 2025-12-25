/**
 * Assessment Module Mock Data
 * Pre-built mock data for assessment module tests
 */

import { vi } from 'vitest';

// =========================================================================
// MOCK DATA CONSTANTS
// =========================================================================

export const MOCK_ORG_ID = 'org-test-123';
export const MOCK_PROJECT_ID = 'project-test-456';
export const MOCK_ASSESSMENT_ID = 'assessment-test-789';
export const MOCK_WORKFLOW_ID = 'workflow-test-abc';
export const MOCK_USER_ID = 'user-test-def';

// =========================================================================
// COMPLETE MOCK ASSESSMENT DATA
// =========================================================================

export const completeMockAssessment = {
    id: MOCK_ASSESSMENT_ID,
    project_id: MOCK_PROJECT_ID,
    organization_id: MOCK_ORG_ID,
    axis_scores: JSON.stringify({
        processes: {
            actual: 4,
            target: 6,
            justification: 'Organizacja posiada zintegrowane systemy CRM i ERP. Procesy biznesowe są w większości zdigitalizowane, jednak niektóre obszary wymagają jeszcze automatyzacji.',
            evidence: ['Dokumentacja CRM', 'Raporty ERP']
        },
        digitalProducts: {
            actual: 3,
            target: 5,
            justification: 'Firma oferuje podstawowe produkty cyfrowe. Portal klienta wymaga modernizacji. Brak aplikacji mobilnej.',
            evidence: ['Analiza produktów cyfrowych']
        },
        businessModels: {
            actual: 3,
            target: 5,
            justification: 'Tradycyjny model biznesowy z elementami cyfrowymi. Brak rozwiniętego modelu subskrypcyjnego.',
            evidence: ['Strategia biznesowa']
        },
        dataManagement: {
            actual: 4,
            target: 6,
            justification: 'Dane są centralizowane w data warehouse. Jakość danych wymaga poprawy. Podstawowa analityka wdrożona.',
            evidence: ['Architektura danych', 'Polityka jakości danych']
        },
        culture: {
            actual: 3,
            target: 5,
            justification: 'Kultura organizacyjna w trakcie transformacji. Część zespołów adaptuje metodyki agile. Potrzeba szkoleń cyfrowych.',
            evidence: ['Ankiety pracownicze', 'Plan szkoleń']
        },
        cybersecurity: {
            actual: 5,
            target: 6,
            justification: 'Wdrożone podstawowe mechanizmy bezpieczeństwa. Certyfikat ISO 27001 w przygotowaniu. Regularne testy penetracyjne.',
            evidence: ['Polityka bezpieczeństwa', 'Raporty audytów']
        },
        aiMaturity: {
            actual: 2,
            target: 5,
            justification: 'Początkowe eksperymenty z AI. Brak strategii AI. Pilotażowe wdrożenie chatbota obsługi klienta.',
            evidence: ['Raport z pilotażu AI']
        }
    }),
    overall_score: 3.43,
    gap_analysis: JSON.stringify({
        overallGap: 1.86,
        priorityGaps: ['aiMaturity', 'digitalProducts', 'culture'],
        estimatedTimeToTarget: '24-36 miesięcy',
        recommendedFocus: 'aiMaturity'
    }),
    status: 'DRAFT',
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-20T14:45:00Z',
    created_by: MOCK_USER_ID
};

// =========================================================================
// MOCK WORKFLOW DATA
// =========================================================================

export const mockWorkflowDraft = {
    id: MOCK_WORKFLOW_ID,
    assessment_id: MOCK_ASSESSMENT_ID,
    status: 'DRAFT',
    current_version: 1,
    completed_reviews: 0,
    total_reviews: 0,
    submitted_at: null,
    submitted_by: null,
    approved_at: null,
    approved_by: null,
    rejected_at: null,
    rejected_by: null,
    rejection_reason: null,
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-15T10:30:00Z'
};

export const mockWorkflowInReview = {
    ...mockWorkflowDraft,
    status: 'IN_REVIEW',
    completed_reviews: 1,
    total_reviews: 3,
    submitted_at: '2024-01-20T09:00:00Z',
    submitted_by: MOCK_USER_ID
};

export const mockWorkflowAwaitingApproval = {
    ...mockWorkflowDraft,
    status: 'AWAITING_APPROVAL',
    completed_reviews: 3,
    total_reviews: 3,
    submitted_at: '2024-01-20T09:00:00Z',
    submitted_by: MOCK_USER_ID
};

export const mockWorkflowApproved = {
    ...mockWorkflowDraft,
    status: 'APPROVED',
    completed_reviews: 3,
    total_reviews: 3,
    submitted_at: '2024-01-20T09:00:00Z',
    submitted_by: MOCK_USER_ID,
    approved_at: '2024-01-25T11:30:00Z',
    approved_by: 'approver-123'
};

export const mockWorkflowRejected = {
    ...mockWorkflowDraft,
    status: 'REJECTED',
    completed_reviews: 2,
    total_reviews: 3,
    submitted_at: '2024-01-20T09:00:00Z',
    submitted_by: MOCK_USER_ID,
    rejected_at: '2024-01-22T16:00:00Z',
    rejected_by: 'reviewer-456',
    rejection_reason: 'Brak wystarczającej dokumentacji dla osi aiMaturity'
};

// =========================================================================
// MOCK REVIEWER DATA
// =========================================================================

export const mockReviewers = [
    {
        id: 'review-1',
        workflow_id: MOCK_WORKFLOW_ID,
        reviewer_id: 'reviewer-cto-123',
        reviewer_name: 'Jan Kowalski',
        reviewer_role: 'CTO',
        status: 'COMPLETED',
        rating: 4,
        recommendation: 'APPROVE',
        comments: 'Dobra ocena, ale warto rozważyć przyspieszenie transformacji AI',
        submitted_at: '2024-01-21T10:00:00Z'
    },
    {
        id: 'review-2',
        workflow_id: MOCK_WORKFLOW_ID,
        reviewer_id: 'reviewer-cfo-456',
        reviewer_name: 'Anna Nowak',
        reviewer_role: 'CFO',
        status: 'COMPLETED',
        rating: 4,
        recommendation: 'APPROVE',
        comments: 'Ocena zgodna z moją percepcją. Budżet na transformację wymaga aktualizacji.',
        submitted_at: '2024-01-21T14:30:00Z'
    },
    {
        id: 'review-3',
        workflow_id: MOCK_WORKFLOW_ID,
        reviewer_id: 'reviewer-hr-789',
        reviewer_name: 'Piotr Wiśniewski',
        reviewer_role: 'CHRO',
        status: 'PENDING',
        rating: null,
        recommendation: null,
        comments: null,
        submitted_at: null
    }
];

// =========================================================================
// MOCK VERSION HISTORY
// =========================================================================

export const mockVersionHistory = [
    {
        id: 'version-1',
        workflow_id: MOCK_WORKFLOW_ID,
        version: 1,
        assessment_data: JSON.stringify(completeMockAssessment),
        change_summary: 'Utworzenie oceny',
        created_at: '2024-01-15T10:30:00Z',
        created_by: MOCK_USER_ID,
        created_by_name: 'Test User'
    },
    {
        id: 'version-2',
        workflow_id: MOCK_WORKFLOW_ID,
        version: 2,
        assessment_data: JSON.stringify({
            ...completeMockAssessment,
            axis_scores: JSON.stringify({
                ...JSON.parse(completeMockAssessment.axis_scores),
                processes: { actual: 5, target: 6, justification: 'Zaktualizowana ocena procesów' }
            })
        }),
        change_summary: 'Aktualizacja oceny procesów',
        created_at: '2024-01-18T11:00:00Z',
        created_by: MOCK_USER_ID,
        created_by_name: 'Test User'
    }
];

// =========================================================================
// MOCK COMMENTS
// =========================================================================

export const mockComments = [
    {
        id: 'comment-1',
        assessment_id: MOCK_ASSESSMENT_ID,
        axis_id: 'processes',
        author_id: 'reviewer-cto-123',
        author_name: 'Jan Kowalski',
        comment: 'Czy możemy dodać więcej szczegółów o integracji z systemami zewnętrznymi?',
        parent_comment_id: null,
        is_resolved: false,
        created_at: '2024-01-21T10:15:00Z'
    },
    {
        id: 'comment-2',
        assessment_id: MOCK_ASSESSMENT_ID,
        axis_id: 'processes',
        author_id: MOCK_USER_ID,
        author_name: 'Test User',
        comment: 'Tak, dodałem informacje o API i integracji z partnerami.',
        parent_comment_id: 'comment-1',
        is_resolved: false,
        created_at: '2024-01-21T11:00:00Z'
    },
    {
        id: 'comment-3',
        assessment_id: MOCK_ASSESSMENT_ID,
        axis_id: 'aiMaturity',
        author_id: 'reviewer-cto-123',
        author_name: 'Jan Kowalski',
        comment: 'Czy planujemy szkolenia z zakresu AI dla zespołu?',
        parent_comment_id: null,
        is_resolved: true,
        created_at: '2024-01-21T10:30:00Z'
    }
];

// =========================================================================
// MOCK USERS
// =========================================================================

export const mockUsers = {
    projectManager: {
        id: MOCK_USER_ID,
        email: 'pm@example.com',
        name: 'Test User',
        organizationId: MOCK_ORG_ID,
        role: 'PROJECT_MANAGER'
    },
    cto: {
        id: 'reviewer-cto-123',
        email: 'cto@example.com',
        name: 'Jan Kowalski',
        organizationId: MOCK_ORG_ID,
        role: 'CTO'
    },
    cfo: {
        id: 'reviewer-cfo-456',
        email: 'cfo@example.com',
        name: 'Anna Nowak',
        organizationId: MOCK_ORG_ID,
        role: 'CFO'
    },
    admin: {
        id: 'admin-123',
        email: 'admin@example.com',
        name: 'Admin User',
        organizationId: MOCK_ORG_ID,
        role: 'ADMIN'
    },
    viewer: {
        id: 'viewer-123',
        email: 'viewer@example.com',
        name: 'Viewer User',
        organizationId: MOCK_ORG_ID,
        role: 'VIEWER'
    }
};

// =========================================================================
// MOCK AI RESPONSES
// =========================================================================

export const mockAIGuidance = {
    axisId: 'processes',
    guidance: `
## Wskazówki dla poziomu 4 (Zintegrowany)

Na tym poziomie dojrzałości cyfrowej organizacja powinna wykazywać:

1. **Integracja systemów** - Pełna integracja między kluczowymi systemami (ERP, CRM, SCM)
2. **Automatyzacja procesów** - Co najmniej 60% procesów biznesowych jest zautomatyzowanych
3. **Monitorowanie w czasie rzeczywistym** - Dashboardy i alerting dla kluczowych KPI

### Typowe dowody:
- Dokumentacja architektury integracji
- Metryki automatyzacji procesów
- Raporty z monitoringu procesów

### Następne kroki do poziomu 5:
- Wdrożenie inteligentnej automatyzacji (RPA + AI)
- Predykcyjne zarządzanie procesami
- Optymalizacja end-to-end
    `,
    mode: 'AI_GENERATED' as const,
    context: {
        currentLevel: 4,
        targetLevel: 6,
        gap: 2
    }
};

export const mockAIValidation = {
    hasInconsistencies: true,
    inconsistencies: [
        {
            type: 'DEPENDENCY_MISMATCH',
            axes: ['aiMaturity', 'dataManagement'],
            severity: 'WARNING',
            description: 'Wysoki poziom dojrzałości AI (5) wymaga zazwyczaj zaawansowanego zarządzania danymi (min. 5). Aktualnie dataManagement = 4.',
            suggestion: 'Rozważ zwiększenie oceny dataManagement lub obniżenie aiMaturity'
        }
    ],
    overallAssessment: 'Ocena wymaga drobnych korekt w zakresie spójności między osiami.',
    confidenceScore: 0.85
};

export const mockAIGapAnalysis = {
    axisId: 'processes',
    axisName: 'Procesy cyfrowe',
    currentScore: 4,
    targetScore: 6,
    gap: 2,
    gapSeverity: 'MEDIUM' as const,
    pathway: [
        {
            level: 5,
            title: 'Optymalizacja',
            description: 'Wdrożenie inteligentnej automatyzacji procesów z wykorzystaniem RPA i ML',
            keyActions: [
                'Identyfikacja procesów do automatyzacji RPA',
                'Wdrożenie pilotażowe w 3 procesach',
                'Szkolenie zespołu z narzędzi automatyzacji'
            ],
            estimatedMonths: 6,
            estimatedCost: '100-200k PLN',
            risks: ['Opór pracowników', 'Złożoność integracji']
        },
        {
            level: 6,
            title: 'Predykcja i samooptymalizacja',
            description: 'Implementacja predykcyjnego zarządzania procesami i ciągłej optymalizacji',
            keyActions: [
                'Wdrożenie process mining',
                'Budowa modeli predykcyjnych',
                'Automatyczna optymalizacja w czasie rzeczywistym'
            ],
            estimatedMonths: 9,
            estimatedCost: '200-400k PLN',
            risks: ['Jakość danych', 'Kompetencje analityczne']
        }
    ],
    estimatedTotalMonths: 15,
    estimatedTotalCost: '300-600k PLN',
    quickWins: [
        'Automatyzacja raportowania',
        'Self-service analytics dla zespołów'
    ]
};

export const mockAIInsights = {
    insights: [
        {
            type: 'STRENGTH' as const,
            priority: 1,
            title: 'Mocna strona: Cyberbezpieczeństwo',
            axis: 'cybersecurity',
            description: 'Wysoki poziom dojrzałości w cyberbezpieczeństwie stanowi solidną podstawę dla transformacji cyfrowej.',
            recommendation: 'Wykorzystaj kompetencje security do wspierania innych inicjatyw'
        },
        {
            type: 'PRIORITY_GAP' as const,
            priority: 2,
            title: 'Priorytetowa luka: Dojrzałość AI',
            axis: 'aiMaturity',
            description: 'Największa luka między stanem obecnym a docelowym. Krytyczne dla konkurencyjności.',
            recommendation: 'Rozpocznij strategiczne inicjatywy AI, zaczynając od use case\'ów z wysokim ROI'
        },
        {
            type: 'DEPENDENCY' as const,
            priority: 3,
            title: 'Zależność: Dane → AI',
            axes: ['dataManagement', 'aiMaturity'],
            description: 'Rozwój AI wymaga równoległego rozwoju zarządzania danymi.',
            recommendation: 'Synchronizuj roadmapy dla danych i AI'
        },
        {
            type: 'OPPORTUNITY' as const,
            priority: 4,
            title: 'Szybka wygrana: Automatyzacja procesów',
            axis: 'processes',
            description: 'Stosunkowo niski wysiłek do przejścia z poziomu 4 na 5.',
            recommendation: 'Rozważ pilotaż RPA w procesach back-office'
        }
    ],
    summary: {
        axesAssessed: 7,
        averageMaturity: 3.43,
        averageTarget: 5.43,
        overallGap: 2.0,
        topStrengths: ['cybersecurity', 'dataManagement'],
        priorityGaps: ['aiMaturity', 'culture', 'digitalProducts'],
        estimatedTransformationTime: '24-36 miesięcy'
    }
};

// =========================================================================
// MOCK SERVICE FACTORIES
// =========================================================================

/**
 * Create mock AssessmentService
 */
export function createMockAssessmentService() {
    return {
        getAssessment: vi.fn().mockResolvedValue(completeMockAssessment),
        saveAssessment: vi.fn().mockResolvedValue({ success: true }),
        finalizeAssessment: vi.fn().mockResolvedValue({ success: true }),
        getAssessmentStatus: vi.fn().mockResolvedValue({ status: 'DRAFT', isComplete: false }),
        canEditAssessment: vi.fn().mockResolvedValue(true),
        generateGapSummary: vi.fn().mockResolvedValue({ gaps: [] })
    };
}

/**
 * Create mock AssessmentWorkflowService
 */
export function createMockWorkflowService() {
    return {
        initializeWorkflow: vi.fn().mockResolvedValue({ workflowId: MOCK_WORKFLOW_ID, status: 'DRAFT' }),
        getWorkflowStatus: vi.fn().mockResolvedValue(mockWorkflowDraft),
        submitForReview: vi.fn().mockResolvedValue({ status: 'IN_REVIEW' }),
        submitReview: vi.fn().mockResolvedValue({ status: 'COMPLETED' }),
        approveAssessment: vi.fn().mockResolvedValue({ status: 'APPROVED' }),
        rejectAssessment: vi.fn().mockResolvedValue({ status: 'REJECTED' }),
        addAxisComment: vi.fn().mockResolvedValue({ commentId: 'comment-new' }),
        getAxisComments: vi.fn().mockResolvedValue(mockComments),
        getWorkflowHistory: vi.fn().mockResolvedValue([]),
        getVersionHistory: vi.fn().mockResolvedValue(mockVersionHistory),
        restoreVersion: vi.fn().mockResolvedValue({ success: true }),
        getPendingReviews: vi.fn().mockResolvedValue(mockReviewers.filter(r => r.status === 'PENDING'))
    };
}

/**
 * Create mock AIAssessmentPartnerService
 */
export function createMockAIPartnerService() {
    return {
        getAssessmentGuidance: vi.fn().mockResolvedValue(mockAIGuidance),
        validateScoreConsistency: vi.fn().mockResolvedValue(mockAIValidation),
        generateGapAnalysis: vi.fn().mockResolvedValue(mockAIGapAnalysis),
        generateProactiveInsights: vi.fn().mockResolvedValue(mockAIInsights),
        askClarifyingQuestion: vi.fn().mockResolvedValue({ question: 'Przykładowe pytanie?' }),
        suggestJustification: vi.fn().mockResolvedValue({ suggestion: 'Sugerowany tekst uzasadnienia...' }),
        suggestEvidence: vi.fn().mockResolvedValue({ evidence: ['Dokument 1', 'Dokument 2'] }),
        suggestTargetScore: vi.fn().mockResolvedValue({ suggestedTarget: 5, reasoning: 'Realistyczny cel' }),
        correctJustificationLanguage: vi.fn().mockResolvedValue({ correctedText: 'Poprawiony tekst' }),
        autocompleteJustification: vi.fn().mockResolvedValue({ completion: 'Dokończenie tekstu...' }),
        generateExecutiveSummary: vi.fn().mockResolvedValue({ summary: 'Podsumowanie wykonawcze...' }),
        generateStakeholderView: vi.fn().mockResolvedValue({ view: 'Widok dla interesariusza...' }),
        generateInitiativesFromGaps: vi.fn().mockResolvedValue({ initiatives: [] }),
        prioritizeInitiatives: vi.fn().mockResolvedValue({ prioritizedList: [] }),
        estimateInitiativeROI: vi.fn().mockResolvedValue({ estimate: {} })
    };
}

/**
 * Create mock RBAC middleware
 */
export function createMockRBAC(allowAll = true) {
    return vi.fn(() => (req: any, res: any, next: any) => {
        if (allowAll) {
            next();
        } else {
            res.status(403).json({ error: 'Forbidden' });
        }
    });
}

/**
 * Create mock AuditLogger
 */
export function createMockAuditLogger() {
    return {
        log: vi.fn().mockResolvedValue(undefined),
        getAuditLog: vi.fn().mockResolvedValue([]),
        getAuditLogForAssessment: vi.fn().mockResolvedValue([])
    };
}

