/**
 * DBR77 Lean 4.0 Assessment Structure
 * 
 * Autorska metoda DBR77 Consultify:
 * KROK 1: POMIERZ (Measure) - analiza stanu obecnego
 * KROK 2: ZOPTYMALIZUJ (Optimize) - klasyczne metody Lean
 * KROK 3: AUTOMATYZUJ (Automate) - audyt możliwości automatyzacji i AI
 * 
 * Dwa wymiary oceny:
 * - PROCESY (flows, value streams)
 * - STANOWISKA (workstations, roles)
 */

import { FrameworkLevel } from './frameworkRegistry';

// ============================================
// TYPES
// ============================================

export type DBR77Phase = 'MEASURE' | 'OPTIMIZE' | 'AUTOMATE';
export type DBR77Dimension = 'PROCESSES' | 'WORKSTATIONS';
export type WasteType = 'TRANSPORTATION' | 'INVENTORY' | 'MOTION' | 'WAITING' | 'OVERPRODUCTION' | 'OVER_PROCESSING' | 'DEFECTS' | 'SKILLS';
export type AutomationTech = 'RPA' | 'AI_ML' | 'IOT' | 'COBOT' | 'AMR' | 'VISION' | 'NLP' | 'DIGITAL_TWIN' | 'WORKFLOW' | 'ANALYTICS';
export type RoleEvolution = 'ELIMINATE' | 'TRANSFORM' | 'AUGMENT' | 'MAINTAIN';

export interface DBR77PhaseConfig {
    id: DBR77Phase;
    name: string;
    nameEN: string;
    description: string;
    descriptionEN: string;
    color: string;
    icon: string;
    outputs: string[];
}

export interface DBR77WasteConfig {
    id: WasteType;
    name: string;
    nameEN: string;
    icon: string;
    description: string;
    examples: string[];
    color: string;
}

export interface DBR77AutomationTechConfig {
    id: AutomationTech;
    name: string;
    nameEN: string;
    description: string;
    applicability: string[];
    complexity: 'LOW' | 'MEDIUM' | 'HIGH';
    typicalROI: string;
}

// ============================================
// PROCESS ASSESSMENT
// ============================================

export interface ProcessCurrentState {
    cycleTime: number; // seconds
    taktTime: number; // seconds
    leadTime: number; // days
    wip: number; // Work in Progress count
    defectRate: number; // percentage
    oee: number; // Overall Equipment Effectiveness %
    valueAddedRatio: number; // % of time adding value
    throughput: number; // units per hour
    changeover: number; // minutes
    uptime: number; // percentage
}

export interface ProcessLeanAssessment {
    wasteIdentified: WasteType[];
    wasteImpact: Record<WasteType, number>; // 1-5 severity
    fiveSLevel: number; // 1-5
    kanbanImplemented: boolean;
    standardWorkDefined: boolean;
    visualManagement: number; // 1-5
    continuousFlow: number; // 1-5
    pullSystem: boolean;
    pokayoke: boolean; // error-proofing
    tpm: number; // Total Productive Maintenance level 1-5
}

export interface ProcessAutomationPotential {
    feasibility: number; // 1-5
    roi: number; // expected ROI percentage
    complexity: 'LOW' | 'MEDIUM' | 'HIGH';
    technologyReadiness: number; // 1-5
    recommendedTechnologies: AutomationTech[];
    humanInLoop: boolean;
    estimatedCost: number; // PLN
    estimatedSavings: number; // PLN per year
    implementationTime: number; // months
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ProcessAssessment {
    id: string;
    name: string;
    department: string;
    category: 'VALUE_STREAM' | 'FLOW' | 'SUPPORT' | 'MANAGEMENT';
    description?: string;
    
    // KROK 1: POMIERZ
    currentState: ProcessCurrentState;
    
    // KROK 2: ZOPTYMALIZUJ
    leanAssessment: ProcessLeanAssessment;
    
    // KROK 3: AUTOMATYZUJ
    automationPotential: ProcessAutomationPotential;
    
    // Metadata
    priority: number; // 1-5
    owner?: string;
    lastUpdated?: string;
}

// ============================================
// WORKSTATION ASSESSMENT
// ============================================

export interface WorkstationCurrentState {
    tasksPerDay: number;
    avgTaskTime: number; // minutes
    errorRate: number; // percentage
    overtimeHours: number; // per week
    skillLevel: number; // 1-5
    toolsUsed: string[];
    digitalMaturity: number; // 1-5
    satisfaction: number; // 1-5 employee satisfaction
    utilization: number; // percentage of productive time
}

export interface WorkstationLeanAssessment {
    workplaceOrganization: number; // 5S level 1-5
    standardizedWork: boolean;
    wasteInRole: WasteType[];
    wasteImpact: Record<WasteType, number>; // 1-5 severity
    skillMatrix: boolean;
    crossTraining: number; // 1-5
    kaizen: number; // suggestions per month
    visualWorkInstructions: boolean;
    workloadBalance: number; // 1-5
}

export interface WorkstationAutomationPotential {
    taskAutomationPercent: number; // % tasks that can be fully automated
    augmentationPercent: number; // % tasks that can be AI-augmented
    roleEvolution: RoleEvolution;
    retrainingNeeded: boolean;
    newSkillsRequired: string[];
    timeToAutomate: number; // months
    estimatedSavings: number; // PLN per year
    recommendedTechnologies: AutomationTech[];
    changeManagementRisk: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface WorkstationAssessment {
    id: string;
    name: string;
    department: string;
    headcount: number;
    description?: string;
    
    // KROK 1: POMIERZ
    currentState: WorkstationCurrentState;
    
    // KROK 2: ZOPTYMALIZUJ
    leanAssessment: WorkstationLeanAssessment;
    
    // KROK 3: AUTOMATYZUJ
    automationPotential: WorkstationAutomationPotential;
    
    // Metadata
    priority: number; // 1-5
    manager?: string;
    lastUpdated?: string;
}

// ============================================
// MANAGEMENT PRACTICES
// ============================================

export interface ManagementPracticesAssessment {
    dailyManagement: {
        tieredMeetings: boolean; // Tier 1, 2, 3
        tier1Frequency: string; // e.g., "daily", "shift"
        tier2Frequency: string;
        tier3Frequency: string;
        visualBoards: number; // 1-5
        kpiTracking: number; // 1-5
        problemSolving: 'NONE' | 'BASIC' | 'A3' | 'DMAIC' | '8D';
        leaderStandardWork: boolean;
        gembaWalks: number; // per week
    };
    
    continuousImprovement: {
        kaizenEvents: number; // per year
        suggestionSystem: boolean;
        suggestionsPerMonth: number;
        implementationRate: number; // percentage
        pdcaCycles: number; // 1-5 maturity
        rootCauseAnalysis: number; // 1-5
        lessonsLearned: boolean;
        improvementBacklog: boolean;
    };
    
    peopleDevelopment: {
        trainingHoursPerYear: number;
        multiSkilling: number; // 1-5
        skillMatrixCoverage: number; // percentage
        successionPlanning: boolean;
        coachingCulture: number; // 1-5
        certifications: string[];
        careerPaths: boolean;
    };
    
    performanceManagement: {
        kpiCascading: boolean;
        balancedScorecard: boolean;
        targetSetting: 'NONE' | 'TOP_DOWN' | 'HOSHIN' | 'OKR';
        reviewFrequency: string;
        rewardSystem: boolean;
        transparentMetrics: boolean;
    };
}

// ============================================
// FULL ASSESSMENT DATA
// ============================================

export interface DBR77AssessmentData {
    processes: ProcessAssessment[];
    workstations: WorkstationAssessment[];
    managementPractices: ManagementPracticesAssessment;
    
    // Aggregated scores
    summary: {
        totalProcesses: number;
        totalWorkstations: number;
        totalHeadcount: number;
        avgLeanMaturity: number;
        avgAutomationPotential: number;
        totalEstimatedSavings: number;
        topWastes: WasteType[];
        priorityInitiatives: string[];
    };
    
    metadata: {
        assessmentDate: string;
        version: string;
        assessor?: string;
        organizationName?: string;
        scope?: string;
    };
}

// ============================================
// CONFIGURATION
// ============================================

export const DBR77_PHASES: DBR77PhaseConfig[] = [
    {
        id: 'MEASURE',
        name: 'POMIERZ',
        nameEN: 'Measure',
        description: 'Analiza stanu obecnego - procesy i stanowiska. Zbierz dane, zmierz metryki.',
        descriptionEN: 'Current state analysis - processes and workstations. Collect data, measure metrics.',
        color: 'blue',
        icon: 'Ruler',
        outputs: [
            'Process Maps',
            'Time Studies',
            'Waste Analysis',
            'Current State VSM',
            'Workstation Profiles',
        ],
    },
    {
        id: 'OPTIMIZE',
        name: 'ZOPTYMALIZUJ',
        nameEN: 'Optimize',
        description: 'Klasyczne metody Lean - eliminacja marnotrawstwa, standaryzacja, przepływ.',
        descriptionEN: 'Classic Lean methods - eliminate waste, standardize, create flow.',
        color: 'green',
        icon: 'TrendingUp',
        outputs: [
            'Future State VSM',
            '5S Implementation Plan',
            'Standard Work Documents',
            'Kanban Design',
            'Kaizen Events',
        ],
    },
    {
        id: 'AUTOMATE',
        name: 'AUTOMATYZUJ',
        nameEN: 'Automate',
        description: 'Audyt możliwości automatyzacji i AI. Identyfikacja technologii, ROI.',
        descriptionEN: 'Automation and AI potential audit. Technology identification, ROI analysis.',
        color: 'purple',
        icon: 'Cpu',
        outputs: [
            'Automation Roadmap',
            'Technology Selection',
            'ROI Analysis',
            'Change Management Plan',
            'Implementation Timeline',
        ],
    },
];

export const DBR77_WASTES: DBR77WasteConfig[] = [
    {
        id: 'TRANSPORTATION',
        name: 'Transport',
        nameEN: 'Transportation',
        icon: 'Truck',
        description: 'Niepotrzebne przemieszczanie materiałów, produktów lub informacji',
        examples: ['Przewożenie WIP między budynkami', 'Wielokrotne przekazywanie dokumentów', 'Zbędne maile w CC'],
        color: 'orange',
    },
    {
        id: 'INVENTORY',
        name: 'Zapasy',
        nameEN: 'Inventory',
        icon: 'Package',
        description: 'Nadmierne zapasy materiałów, WIP lub produktów gotowych',
        examples: ['Nadmierne stany magazynowe', 'Duże partie produkcyjne', 'Backlog zadań'],
        color: 'yellow',
    },
    {
        id: 'MOTION',
        name: 'Ruch',
        nameEN: 'Motion',
        icon: 'Move',
        description: 'Niepotrzebne ruchy pracowników',
        examples: ['Szukanie narzędzi', 'Chodzenie po materiały', 'Nieergonomiczne stanowisko'],
        color: 'blue',
    },
    {
        id: 'WAITING',
        name: 'Czekanie',
        nameEN: 'Waiting',
        icon: 'Clock',
        description: 'Czas bezczynności - czekanie na materiały, informacje, decyzje',
        examples: ['Oczekiwanie na zatwierdzenie', 'Przestoje maszyn', 'Oczekiwanie na odpowiedź'],
        color: 'gray',
    },
    {
        id: 'OVERPRODUCTION',
        name: 'Nadprodukcja',
        nameEN: 'Overproduction',
        icon: 'PlusCircle',
        description: 'Produkowanie więcej niż potrzeba lub wcześniej niż potrzeba',
        examples: ['Produkcja "na wszelki wypadek"', 'Tworzenie niepotrzebnych raportów', 'Nadmiarowe funkcje'],
        color: 'red',
    },
    {
        id: 'OVER_PROCESSING',
        name: 'Nadmierne przetwarzanie',
        nameEN: 'Over-processing',
        icon: 'Settings',
        description: 'Wykonywanie więcej pracy niż wymaga klient',
        examples: ['Zbyt dokładna kontrola jakości', 'Nadmiarowe zatwierdzenia', 'Złożone procedury'],
        color: 'purple',
    },
    {
        id: 'DEFECTS',
        name: 'Defekty',
        nameEN: 'Defects',
        icon: 'XCircle',
        description: 'Błędy wymagające poprawek lub powodujące reklamacje',
        examples: ['Wadliwe produkty', 'Błędy w dokumentach', 'Pomyłki w zamówieniach'],
        color: 'red',
    },
    {
        id: 'SKILLS',
        name: 'Niewykorzystane talenty',
        nameEN: 'Non-utilized talent',
        icon: 'UserX',
        description: 'Niewykorzystanie potencjału, wiedzy i kreatywności pracowników',
        examples: ['Brak sugestii pracowników', 'Nieoptymalne przydzielanie zadań', 'Brak rozwoju'],
        color: 'cyan',
    },
];

export const DBR77_AUTOMATION_TECHNOLOGIES: DBR77AutomationTechConfig[] = [
    {
        id: 'RPA',
        name: 'RPA (Robotic Process Automation)',
        nameEN: 'Robotic Process Automation',
        description: 'Automatyzacja powtarzalnych zadań w systemach IT',
        applicability: ['Data entry', 'Report generation', 'System integration', 'Form processing'],
        complexity: 'LOW',
        typicalROI: '200-400% w 12 miesięcy',
    },
    {
        id: 'AI_ML',
        name: 'AI/Machine Learning',
        nameEN: 'AI/Machine Learning',
        description: 'Uczenie maszynowe do predykcji, klasyfikacji i optymalizacji',
        applicability: ['Demand forecasting', 'Quality prediction', 'Anomaly detection', 'Recommendation'],
        complexity: 'HIGH',
        typicalROI: '150-300% w 18-24 miesięcy',
    },
    {
        id: 'IOT',
        name: 'IoT (Internet of Things)',
        nameEN: 'Internet of Things',
        description: 'Czujniki i urządzenia połączone do zbierania danych w czasie rzeczywistym',
        applicability: ['Machine monitoring', 'Environment sensing', 'Asset tracking', 'Predictive maintenance'],
        complexity: 'MEDIUM',
        typicalROI: '100-250% w 18 miesięcy',
    },
    {
        id: 'COBOT',
        name: 'Coboty (Collaborative Robots)',
        nameEN: 'Collaborative Robots',
        description: 'Roboty współpracujące z ludźmi przy powtarzalnych zadaniach fizycznych',
        applicability: ['Assembly', 'Packaging', 'Material handling', 'Quality inspection'],
        complexity: 'MEDIUM',
        typicalROI: '150-300% w 24 miesięcy',
    },
    {
        id: 'AMR',
        name: 'AMR (Autonomous Mobile Robots)',
        nameEN: 'Autonomous Mobile Robots',
        description: 'Autonomiczne roboty mobilne do transportu wewnętrznego',
        applicability: ['Material transport', 'Warehouse picking', 'Delivery', 'Inventory'],
        complexity: 'MEDIUM',
        typicalROI: '100-200% w 24 miesięcy',
    },
    {
        id: 'VISION',
        name: 'Computer Vision',
        nameEN: 'Computer Vision',
        description: 'Systemy wizyjne do inspekcji i rozpoznawania',
        applicability: ['Quality inspection', 'Object detection', 'OCR/reading', 'Safety monitoring'],
        complexity: 'MEDIUM',
        typicalROI: '150-250% w 18 miesięcy',
    },
    {
        id: 'NLP',
        name: 'NLP (Natural Language Processing)',
        nameEN: 'Natural Language Processing',
        description: 'Przetwarzanie języka naturalnego do komunikacji i analizy tekstu',
        applicability: ['Chatbots', 'Document analysis', 'Email classification', 'Voice interfaces'],
        complexity: 'MEDIUM',
        typicalROI: '100-200% w 12 miesięcy',
    },
    {
        id: 'DIGITAL_TWIN',
        name: 'Digital Twin',
        nameEN: 'Digital Twin',
        description: 'Cyfrowy bliźniak do symulacji i optymalizacji',
        applicability: ['Process simulation', 'Predictive maintenance', 'Optimization', 'Training'],
        complexity: 'HIGH',
        typicalROI: '100-200% w 24-36 miesięcy',
    },
    {
        id: 'WORKFLOW',
        name: 'Workflow Automation',
        nameEN: 'Workflow Automation',
        description: 'Automatyzacja przepływów pracy i zatwierdzania',
        applicability: ['Approvals', 'Routing', 'Notifications', 'Task assignment'],
        complexity: 'LOW',
        typicalROI: '200-400% w 6-12 miesięcy',
    },
    {
        id: 'ANALYTICS',
        name: 'Advanced Analytics',
        nameEN: 'Advanced Analytics',
        description: 'Zaawansowana analityka i dashboardy',
        applicability: ['KPI monitoring', 'Trend analysis', 'Root cause analysis', 'Reporting'],
        complexity: 'LOW',
        typicalROI: '150-300% w 12 miesięcy',
    },
];

export const DBR77_ROLE_EVOLUTION: Record<RoleEvolution, { name: string; nameEN: string; description: string; color: string }> = {
    ELIMINATE: {
        name: 'Eliminacja',
        nameEN: 'Eliminate',
        description: 'Rola może być w pełni zautomatyzowana i wyeliminowana',
        color: 'red',
    },
    TRANSFORM: {
        name: 'Transformacja',
        nameEN: 'Transform',
        description: 'Rola znacząco się zmieni - nowe zadania i odpowiedzialności',
        color: 'orange',
    },
    AUGMENT: {
        name: 'Augmentacja',
        nameEN: 'Augment',
        description: 'AI/automatyzacja wesprze pracownika w wykonywaniu zadań',
        color: 'blue',
    },
    MAINTAIN: {
        name: 'Utrzymanie',
        nameEN: 'Maintain',
        description: 'Rola pozostanie zasadniczo niezmieniona',
        color: 'green',
    },
};

// ============================================
// MATURITY LEVELS (for Lean assessment)
// ============================================

export const DBR77_LEAN_MATURITY_LEVELS: FrameworkLevel[] = [
    {
        level: 1,
        title: 'Ad-hoc',
        description: 'Brak standardów, działanie reaktywne, chaos operacyjny',
    },
    {
        level: 2,
        title: 'Podstawowy',
        description: 'Podstawowe standardy, niektóre narzędzia Lean wdrożone lokalnie',
    },
    {
        level: 3,
        title: 'Zdefiniowany',
        description: 'Standardowe procesy, systematyczne użycie narzędzi Lean',
    },
    {
        level: 4,
        title: 'Zarządzany',
        description: 'Metryki i KPI, ciągłe doskonalenie, kultura Lean',
    },
    {
        level: 5,
        title: 'Optymalizowany',
        description: 'Doskonałość operacyjna, autonomiczne doskonalenie, benchmark',
    },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get phase configuration by ID
 */
export function getPhaseConfig(phaseId: DBR77Phase): DBR77PhaseConfig {
    return DBR77_PHASES.find(p => p.id === phaseId)!;
}

/**
 * Get waste configuration by ID
 */
export function getWasteConfig(wasteId: WasteType): DBR77WasteConfig {
    return DBR77_WASTES.find(w => w.id === wasteId)!;
}

/**
 * Get automation technology configuration by ID
 */
export function getAutomationTechConfig(techId: AutomationTech): DBR77AutomationTechConfig {
    return DBR77_AUTOMATION_TECHNOLOGIES.find(t => t.id === techId)!;
}

/**
 * Calculate overall Lean maturity score
 */
export function calculateLeanMaturity(assessment: DBR77AssessmentData): number {
    const processScores = assessment.processes.map(p => 
        (p.leanAssessment.fiveSLevel + 
         p.leanAssessment.visualManagement + 
         p.leanAssessment.continuousFlow + 
         p.leanAssessment.tpm) / 4
    );
    
    const workstationScores = assessment.workstations.map(w =>
        (w.leanAssessment.workplaceOrganization + 
         w.leanAssessment.crossTraining + 
         w.leanAssessment.workloadBalance) / 3
    );
    
    const allScores = [...processScores, ...workstationScores].filter(s => s > 0);
    if (allScores.length === 0) return 0;
    
    return Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10;
}

/**
 * Calculate overall automation potential
 */
export function calculateAutomationPotential(assessment: DBR77AssessmentData): number {
    const processScores = assessment.processes.map(p => p.automationPotential.feasibility);
    const workstationScores = assessment.workstations.map(w => 
        (w.automationPotential.taskAutomationPercent + w.automationPotential.augmentationPercent) / 20 // Convert to 1-5 scale
    );
    
    const allScores = [...processScores, ...workstationScores].filter(s => s > 0);
    if (allScores.length === 0) return 0;
    
    return Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10;
}

/**
 * Calculate total estimated savings
 */
export function calculateTotalSavings(assessment: DBR77AssessmentData): number {
    const processSavings = assessment.processes.reduce((sum, p) => 
        sum + (p.automationPotential.estimatedSavings || 0), 0
    );
    const workstationSavings = assessment.workstations.reduce((sum, w) => 
        sum + (w.automationPotential.estimatedSavings || 0), 0
    );
    return processSavings + workstationSavings;
}

/**
 * Get top wastes across all processes and workstations
 */
export function getTopWastes(assessment: DBR77AssessmentData, limit: number = 5): WasteType[] {
    const wasteCounts: Record<WasteType, number> = {} as Record<WasteType, number>;
    
    assessment.processes.forEach(p => {
        p.leanAssessment.wasteIdentified.forEach(w => {
            wasteCounts[w] = (wasteCounts[w] || 0) + (p.leanAssessment.wasteImpact[w] || 1);
        });
    });
    
    assessment.workstations.forEach(ws => {
        ws.leanAssessment.wasteInRole.forEach(w => {
            wasteCounts[w] = (wasteCounts[w] || 0) + (ws.leanAssessment.wasteImpact[w] || 1);
        });
    });
    
    return Object.entries(wasteCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([wasteId]) => wasteId as WasteType);
}

/**
 * Create empty DBR77 assessment
 */
export function createEmptyDBR77Assessment(): DBR77AssessmentData {
    return {
        processes: [],
        workstations: [],
        managementPractices: {
            dailyManagement: {
                tieredMeetings: false,
                tier1Frequency: '',
                tier2Frequency: '',
                tier3Frequency: '',
                visualBoards: 1,
                kpiTracking: 1,
                problemSolving: 'NONE',
                leaderStandardWork: false,
                gembaWalks: 0,
            },
            continuousImprovement: {
                kaizenEvents: 0,
                suggestionSystem: false,
                suggestionsPerMonth: 0,
                implementationRate: 0,
                pdcaCycles: 1,
                rootCauseAnalysis: 1,
                lessonsLearned: false,
                improvementBacklog: false,
            },
            peopleDevelopment: {
                trainingHoursPerYear: 0,
                multiSkilling: 1,
                skillMatrixCoverage: 0,
                successionPlanning: false,
                coachingCulture: 1,
                certifications: [],
                careerPaths: false,
            },
            performanceManagement: {
                kpiCascading: false,
                balancedScorecard: false,
                targetSetting: 'NONE',
                reviewFrequency: '',
                rewardSystem: false,
                transparentMetrics: false,
            },
        },
        summary: {
            totalProcesses: 0,
            totalWorkstations: 0,
            totalHeadcount: 0,
            avgLeanMaturity: 0,
            avgAutomationPotential: 0,
            totalEstimatedSavings: 0,
            topWastes: [],
            priorityInitiatives: [],
        },
        metadata: {
            assessmentDate: new Date().toISOString(),
            version: '1.0',
        },
    };
}

/**
 * Create empty process assessment
 */
export function createEmptyProcessAssessment(id: string, name: string): ProcessAssessment {
    return {
        id,
        name,
        department: '',
        category: 'FLOW',
        currentState: {
            cycleTime: 0,
            taktTime: 0,
            leadTime: 0,
            wip: 0,
            defectRate: 0,
            oee: 0,
            valueAddedRatio: 0,
            throughput: 0,
            changeover: 0,
            uptime: 0,
        },
        leanAssessment: {
            wasteIdentified: [],
            wasteImpact: {} as Record<WasteType, number>,
            fiveSLevel: 1,
            kanbanImplemented: false,
            standardWorkDefined: false,
            visualManagement: 1,
            continuousFlow: 1,
            pullSystem: false,
            pokayoke: false,
            tpm: 1,
        },
        automationPotential: {
            feasibility: 1,
            roi: 0,
            complexity: 'MEDIUM',
            technologyReadiness: 1,
            recommendedTechnologies: [],
            humanInLoop: true,
            estimatedCost: 0,
            estimatedSavings: 0,
            implementationTime: 0,
            riskLevel: 'MEDIUM',
        },
        priority: 3,
    };
}

/**
 * Create empty workstation assessment
 */
export function createEmptyWorkstationAssessment(id: string, name: string): WorkstationAssessment {
    return {
        id,
        name,
        department: '',
        headcount: 1,
        currentState: {
            tasksPerDay: 0,
            avgTaskTime: 0,
            errorRate: 0,
            overtimeHours: 0,
            skillLevel: 1,
            toolsUsed: [],
            digitalMaturity: 1,
            satisfaction: 3,
            utilization: 0,
        },
        leanAssessment: {
            workplaceOrganization: 1,
            standardizedWork: false,
            wasteInRole: [],
            wasteImpact: {} as Record<WasteType, number>,
            skillMatrix: false,
            crossTraining: 1,
            kaizen: 0,
            visualWorkInstructions: false,
            workloadBalance: 1,
        },
        automationPotential: {
            taskAutomationPercent: 0,
            augmentationPercent: 0,
            roleEvolution: 'MAINTAIN',
            retrainingNeeded: false,
            newSkillsRequired: [],
            timeToAutomate: 0,
            estimatedSavings: 0,
            recommendedTechnologies: [],
            changeManagementRisk: 'MEDIUM',
        },
        priority: 3,
    };
}

/**
 * Map DBR77 waste to DRD axis for initiative generation
 */
export function mapWasteToDRDAxis(wasteType: WasteType): string {
    const mapping: Record<WasteType, string> = {
        'TRANSPORTATION': 'processes',
        'INVENTORY': 'processes',
        'MOTION': 'processes',
        'WAITING': 'processes',
        'OVERPRODUCTION': 'processes',
        'OVER_PROCESSING': 'processes',
        'DEFECTS': 'processes',
        'SKILLS': 'culture',
    };
    return mapping[wasteType];
}

export default {
    DBR77_PHASES,
    DBR77_WASTES,
    DBR77_AUTOMATION_TECHNOLOGIES,
    DBR77_ROLE_EVOLUTION,
    DBR77_LEAN_MATURITY_LEVELS,
};








