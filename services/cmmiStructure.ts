/**
 * CMMI (Capability Maturity Model Integration) Structure
 * 
 * CMMI jest znakiem towarowym ISACA (dawniej CMMI Institute).
 * Oficjalna certyfikacja CMMI wymaga akredytowanego Lead Appraiser.
 * Implementacja w Consultify służy celom edukacyjnym.
 * 
 * Structure:
 * - 5 Maturity Levels (Initial → Optimizing)
 * - 20 Practice Areas in 3 Categories (Doing, Managing, Enabling)
 * - Scale: 1-5
 */

import { FrameworkDimension, FrameworkLevel } from './frameworkRegistry';

// ============================================
// TYPES
// ============================================

export type CMMICategory = 'DOING' | 'MANAGING' | 'ENABLING';

export interface CMMIMaturityLevel extends FrameworkLevel {
    level: number; // 1-5
    name: string;
    title: string;
    description: string;
    characteristics: string[];
    color: string;
}

export interface CMMIPracticeArea extends FrameworkDimension {
    id: string;
    code: string; // e.g., 'EST', 'PAD'
    name: string;
    namePL: string;
    category: CMMICategory;
    description: string;
    descriptionPL: string;
    levels: FrameworkLevel[];
}

export interface CMMICategoryConfig {
    id: CMMICategory;
    name: string;
    namePL: string;
    description: string;
    descriptionPL: string;
    color: string;
    icon: string;
    practiceAreaIds: string[];
}

export interface CMMIAssessmentData {
    maturityLevel: number;
    practiceAreas: Record<string, CMMIPracticeAreaScore>;
    categories: Record<CMMICategory, CMMICategoryScore>;
    overallScore: number;
    metadata: {
        assessmentDate: string;
        version: string;
        source: 'manual' | 'imported';
        model: 'DEV' | 'SVC' | 'SPM'; // Development, Services, Supplier Management
    };
}

export interface CMMIPracticeAreaScore {
    level: number; // 1-5
    target?: number;
    evidence?: string;
    gaps?: string[];
}

export interface CMMICategoryScore {
    averageLevel: number;
    practiceAreaScores: Record<string, number>;
}

// ============================================
// MATURITY LEVELS
// ============================================

export const CMMI_MATURITY_LEVELS: CMMIMaturityLevel[] = [
    {
        level: 1,
        name: 'Initial',
        title: 'Level 1: Initial',
        description: 'Processes unpredictable, poorly controlled and reactive. Success depends on individual heroics.',
        characteristics: [
            'Ad hoc and chaotic',
            'Success depends on individuals',
            'Unpredictable outcomes',
            'Reactive problem solving',
            'No standard processes',
        ],
        color: 'red',
    },
    {
        level: 2,
        name: 'Managed',
        title: 'Level 2: Managed',
        description: 'Processes characterized for projects and often reactive. Project-level discipline.',
        characteristics: [
            'Project-level discipline',
            'Requirements managed',
            'Work planned and tracked',
            'Process may differ between projects',
            'Reactive quality management',
        ],
        color: 'orange',
    },
    {
        level: 3,
        name: 'Defined',
        title: 'Level 3: Defined',
        description: 'Processes characterized for organization and proactive. Standard processes established.',
        characteristics: [
            'Organizational standards',
            'Process tailoring guidelines',
            'Proactive approach',
            'Integrated management',
            'Consistent practices',
        ],
        color: 'yellow',
    },
    {
        level: 4,
        name: 'Quantitatively Managed',
        title: 'Level 4: Quantitatively Managed',
        description: 'Processes measured and controlled. Statistical management and quantitative objectives.',
        characteristics: [
            'Statistical process control',
            'Quantitative objectives',
            'Performance baselines',
            'Predictable outcomes',
            'Data-driven decisions',
        ],
        color: 'blue',
    },
    {
        level: 5,
        name: 'Optimizing',
        title: 'Level 5: Optimizing',
        description: 'Focus on continuous improvement. Innovation and optimization are institutionalized.',
        characteristics: [
            'Continuous improvement',
            'Innovation deployment',
            'Causal analysis',
            'Defect prevention',
            'Process optimization',
        ],
        color: 'green',
    },
];

// ============================================
// CATEGORIES CONFIGURATION
// ============================================

export const CMMI_CATEGORIES: Record<CMMICategory, CMMICategoryConfig> = {
    DOING: {
        id: 'DOING',
        name: 'Doing',
        namePL: 'Realizacja',
        description: 'Deliver value through development and delivery practices',
        descriptionPL: 'Dostarczanie wartości poprzez praktyki rozwoju i dostawy',
        color: 'blue',
        icon: 'Rocket',
        practiceAreaIds: ['EST', 'PAD', 'MC', 'PI', 'PQA', 'RDM', 'RM', 'TS', 'VER', 'VAL'],
    },
    MANAGING: {
        id: 'MANAGING',
        name: 'Managing',
        namePL: 'Zarządzanie',
        description: 'Manage work, resources, and risks effectively',
        descriptionPL: 'Efektywne zarządzanie pracą, zasobami i ryzykiem',
        color: 'purple',
        icon: 'Briefcase',
        practiceAreaIds: ['CAR', 'CM', 'DAR', 'RSKM', 'SAM'],
    },
    ENABLING: {
        id: 'ENABLING',
        name: 'Enabling',
        namePL: 'Wsparcie',
        description: 'Enable capability, infrastructure, and organizational support',
        descriptionPL: 'Umożliwienie zdolności, infrastruktury i wsparcia organizacyjnego',
        color: 'green',
        icon: 'Building',
        practiceAreaIds: ['GOV', 'II', 'OT', 'PCM', 'MPM'],
    },
};

// ============================================
// PRACTICE AREAS
// ============================================

const PRACTICE_AREA_LEVELS: FrameworkLevel[] = CMMI_MATURITY_LEVELS.map(l => ({
    level: l.level,
    title: l.name,
    description: l.description,
}));

export const CMMI_PRACTICE_AREAS: CMMIPracticeArea[] = [
    // DOING - Deliver Value
    {
        id: 'EST',
        code: 'EST',
        name: 'Estimating',
        namePL: 'Szacowanie',
        category: 'DOING',
        description: 'Develop and manage effort, cost, and schedule estimates',
        descriptionPL: 'Opracowanie i zarządzanie szacunkami nakładu, kosztów i harmonogramu',
        levels: PRACTICE_AREA_LEVELS,
    },
    {
        id: 'PAD',
        code: 'PAD',
        name: 'Planning',
        namePL: 'Planowanie',
        category: 'DOING',
        description: 'Establish and maintain plans for performing work',
        descriptionPL: 'Tworzenie i utrzymywanie planów wykonania pracy',
        levels: PRACTICE_AREA_LEVELS,
    },
    {
        id: 'MC',
        code: 'MC',
        name: 'Monitor & Control',
        namePL: 'Monitorowanie i Kontrola',
        category: 'DOING',
        description: 'Provide understanding of project progress for corrective action',
        descriptionPL: 'Zapewnienie zrozumienia postępu projektu dla działań korygujących',
        levels: PRACTICE_AREA_LEVELS,
    },
    {
        id: 'PI',
        code: 'PI',
        name: 'Peer Reviews',
        namePL: 'Przeglądy Koleżeńskie',
        category: 'DOING',
        description: 'Verify developed work products through peer reviews',
        descriptionPL: 'Weryfikacja opracowanych produktów pracy poprzez przeglądy koleżeńskie',
        levels: PRACTICE_AREA_LEVELS,
    },
    {
        id: 'PQA',
        code: 'PQA',
        name: 'Process Quality Assurance',
        namePL: 'Zapewnienie Jakości Procesu',
        category: 'DOING',
        description: 'Objectively evaluate adherence to process descriptions and standards',
        descriptionPL: 'Obiektywna ocena zgodności z opisami procesów i standardami',
        levels: PRACTICE_AREA_LEVELS,
    },
    {
        id: 'RDM',
        code: 'RDM',
        name: 'Requirements Development & Management',
        namePL: 'Opracowanie i Zarządzanie Wymaganiami',
        category: 'DOING',
        description: 'Elicit, analyze, and establish customer, product, and product-component requirements',
        descriptionPL: 'Pozyskiwanie, analiza i ustalanie wymagań klienta, produktu i komponentów',
        levels: PRACTICE_AREA_LEVELS,
    },
    {
        id: 'RM',
        code: 'RM',
        name: 'Requirements Management',
        namePL: 'Zarządzanie Wymaganiami',
        category: 'DOING',
        description: 'Manage requirements throughout the project lifecycle',
        descriptionPL: 'Zarządzanie wymaganiami w całym cyklu życia projektu',
        levels: PRACTICE_AREA_LEVELS,
    },
    {
        id: 'TS',
        code: 'TS',
        name: 'Technical Solution',
        namePL: 'Rozwiązanie Techniczne',
        category: 'DOING',
        description: 'Design and implement solutions to requirements',
        descriptionPL: 'Projektowanie i implementacja rozwiązań dla wymagań',
        levels: PRACTICE_AREA_LEVELS,
    },
    {
        id: 'VER',
        code: 'VER',
        name: 'Verification',
        namePL: 'Weryfikacja',
        category: 'DOING',
        description: 'Ensure work products meet their specified requirements',
        descriptionPL: 'Zapewnienie, że produkty pracy spełniają określone wymagania',
        levels: PRACTICE_AREA_LEVELS,
    },
    {
        id: 'VAL',
        code: 'VAL',
        name: 'Validation',
        namePL: 'Walidacja',
        category: 'DOING',
        description: 'Demonstrate product meets its intended use',
        descriptionPL: 'Wykazanie, że produkt spełnia zamierzone zastosowanie',
        levels: PRACTICE_AREA_LEVELS,
    },
    
    // MANAGING - Manage Work
    {
        id: 'CAR',
        code: 'CAR',
        name: 'Causal Analysis & Resolution',
        namePL: 'Analiza Przyczynowa i Rozwiązywanie',
        category: 'MANAGING',
        description: 'Identify causes of outcomes and take action to improve performance',
        descriptionPL: 'Identyfikacja przyczyn wyników i podejmowanie działań w celu poprawy wydajności',
        levels: PRACTICE_AREA_LEVELS,
    },
    {
        id: 'CM',
        code: 'CM',
        name: 'Configuration Management',
        namePL: 'Zarządzanie Konfiguracją',
        category: 'MANAGING',
        description: 'Establish and maintain integrity of work products',
        descriptionPL: 'Ustanowienie i utrzymanie integralności produktów pracy',
        levels: PRACTICE_AREA_LEVELS,
    },
    {
        id: 'DAR',
        code: 'DAR',
        name: 'Decision Analysis & Resolution',
        namePL: 'Analiza Decyzji i Rozwiązywanie',
        category: 'MANAGING',
        description: 'Analyze possible decisions using formal evaluation process',
        descriptionPL: 'Analiza możliwych decyzji przy użyciu formalnego procesu oceny',
        levels: PRACTICE_AREA_LEVELS,
    },
    {
        id: 'RSKM',
        code: 'RSKM',
        name: 'Risk & Opportunity Management',
        namePL: 'Zarządzanie Ryzykiem i Szansami',
        category: 'MANAGING',
        description: 'Identify potential problems and opportunities before they occur',
        descriptionPL: 'Identyfikacja potencjalnych problemów i szans przed ich wystąpieniem',
        levels: PRACTICE_AREA_LEVELS,
    },
    {
        id: 'SAM',
        code: 'SAM',
        name: 'Supplier Agreement Management',
        namePL: 'Zarządzanie Umowami z Dostawcami',
        category: 'MANAGING',
        description: 'Manage acquisition of products and services from suppliers',
        descriptionPL: 'Zarządzanie nabywaniem produktów i usług od dostawców',
        levels: PRACTICE_AREA_LEVELS,
    },
    
    // ENABLING - Enable Capability
    {
        id: 'GOV',
        code: 'GOV',
        name: 'Governance',
        namePL: 'Governance',
        category: 'ENABLING',
        description: 'Govern organizational activities to achieve business objectives',
        descriptionPL: 'Zarządzanie działalnością organizacyjną dla osiągnięcia celów biznesowych',
        levels: PRACTICE_AREA_LEVELS,
    },
    {
        id: 'II',
        code: 'II',
        name: 'Implementation Infrastructure',
        namePL: 'Infrastruktura Wdrożeniowa',
        category: 'ENABLING',
        description: 'Establish and maintain process capability for organization',
        descriptionPL: 'Ustanowienie i utrzymanie zdolności procesowej dla organizacji',
        levels: PRACTICE_AREA_LEVELS,
    },
    {
        id: 'OT',
        code: 'OT',
        name: 'Organizational Training',
        namePL: 'Szkolenia Organizacyjne',
        category: 'ENABLING',
        description: 'Develop skills and knowledge so people can perform their roles',
        descriptionPL: 'Rozwijanie umiejętności i wiedzy, aby ludzie mogli pełnić swoje role',
        levels: PRACTICE_AREA_LEVELS,
    },
    {
        id: 'PCM',
        code: 'PCM',
        name: 'Process Management',
        namePL: 'Zarządzanie Procesami',
        category: 'ENABLING',
        description: 'Plan and implement process improvement based on understanding',
        descriptionPL: 'Planowanie i wdrażanie doskonalenia procesów w oparciu o zrozumienie',
        levels: PRACTICE_AREA_LEVELS,
    },
    {
        id: 'MPM',
        code: 'MPM',
        name: 'Managing Performance & Measurement',
        namePL: 'Zarządzanie Wydajnością i Pomiarami',
        category: 'ENABLING',
        description: 'Manage organizational performance and establish measurement capability',
        descriptionPL: 'Zarządzanie wydajnością organizacyjną i ustanowienie zdolności pomiarowej',
        levels: PRACTICE_AREA_LEVELS,
    },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get practice area by ID
 */
export function getCMMIPracticeArea(practiceAreaId: string): CMMIPracticeArea | undefined {
    return CMMI_PRACTICE_AREAS.find(pa => pa.id === practiceAreaId || pa.code === practiceAreaId);
}

/**
 * Get practice areas for a category
 */
export function getPracticeAreasForCategory(category: CMMICategory): CMMIPracticeArea[] {
    return CMMI_PRACTICE_AREAS.filter(pa => pa.category === category);
}

/**
 * Get all categories
 */
export function getAllCategories(): CMMICategory[] {
    return Object.keys(CMMI_CATEGORIES) as CMMICategory[];
}

/**
 * Get maturity level description
 */
export function getMaturityLevelInfo(level: number): CMMIMaturityLevel | undefined {
    return CMMI_MATURITY_LEVELS.find(l => l.level === level);
}

/**
 * Calculate category score from practice area scores
 */
export function calculateCategoryScore(practiceAreaScores: Record<string, number>, category: CMMICategory): number {
    const categoryConfig = CMMI_CATEGORIES[category];
    const relevantScores = categoryConfig.practiceAreaIds
        .map(id => practiceAreaScores[id])
        .filter(score => score !== undefined && score !== null && score > 0);
    
    if (relevantScores.length === 0) return 0;
    return Math.round((relevantScores.reduce((a, b) => a + b, 0) / relevantScores.length) * 10) / 10;
}

/**
 * Calculate overall CMMI maturity level
 * CMMI requires ALL practice areas at a level to achieve that level
 */
export function calculateOverallMaturityLevel(practiceAreaScores: Record<string, number>): number {
    const scores = Object.values(practiceAreaScores).filter(s => s !== undefined && s !== null && s > 0);
    if (scores.length === 0) return 1;
    
    // Overall level is the minimum across all practice areas
    // (CMMI requires all areas at a level to achieve that level)
    return Math.min(...scores);
}

/**
 * Calculate average score (for comparison, not certification)
 */
export function calculateAverageScore(practiceAreaScores: Record<string, number>): number {
    const scores = Object.values(practiceAreaScores).filter(s => s !== undefined && s !== null && s > 0);
    if (scores.length === 0) return 0;
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

/**
 * Map CMMI practice area to DRD axis for initiative generation
 */
export function mapCMMIPracticeAreaToDRD(practiceAreaId: string): string {
    const mapping: Record<string, string> = {
        'EST': 'processes',
        'PAD': 'processes',
        'MC': 'processes',
        'PI': 'processes',
        'PQA': 'processes',
        'RDM': 'digitalProducts',
        'RM': 'processes',
        'TS': 'digitalProducts',
        'VER': 'processes',
        'VAL': 'processes',
        'CAR': 'dataManagement',
        'CM': 'processes',
        'DAR': 'businessModels',
        'RSKM': 'processes',
        'SAM': 'processes',
        'GOV': 'culture',
        'II': 'processes',
        'OT': 'culture',
        'PCM': 'processes',
        'MPM': 'dataManagement',
    };
    return mapping[practiceAreaId] || 'processes';
}

/**
 * Create empty CMMI assessment data
 */
export function createEmptyCMMIAssessment(): CMMIAssessmentData {
    const practiceAreas: Record<string, CMMIPracticeAreaScore> = {};
    CMMI_PRACTICE_AREAS.forEach(pa => {
        practiceAreas[pa.id] = { level: 0 };
    });
    
    const categories: Record<CMMICategory, CMMICategoryScore> = {
        DOING: { averageLevel: 0, practiceAreaScores: {} },
        MANAGING: { averageLevel: 0, practiceAreaScores: {} },
        ENABLING: { averageLevel: 0, practiceAreaScores: {} },
    };
    
    return {
        maturityLevel: 1,
        practiceAreas,
        categories,
        overallScore: 0,
        metadata: {
            assessmentDate: new Date().toISOString(),
            version: '2.0',
            source: 'manual',
            model: 'DEV',
        },
    };
}

/**
 * Get gaps - practice areas below target level
 */
export function getCMMIGaps(
    practiceAreaScores: Record<string, CMMIPracticeAreaScore>,
    targetLevel: number
): { practiceArea: CMMIPracticeArea; currentLevel: number; gap: number }[] {
    const gaps: { practiceArea: CMMIPracticeArea; currentLevel: number; gap: number }[] = [];
    
    CMMI_PRACTICE_AREAS.forEach(pa => {
        const score = practiceAreaScores[pa.id];
        const currentLevel = score?.level || 0;
        if (currentLevel < targetLevel) {
            gaps.push({
                practiceArea: pa,
                currentLevel,
                gap: targetLevel - currentLevel,
            });
        }
    });
    
    return gaps.sort((a, b) => b.gap - a.gap);
}

export default {
    CMMI_MATURITY_LEVELS,
    CMMI_CATEGORIES,
    CMMI_PRACTICE_AREAS,
};






