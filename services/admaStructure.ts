/**
 * ADMA 2.0 (Advanced Digital Maturity Assessment) Structure
 * 
 * ADMA jest narzędziem opracowanym przez European Commission w ramach
 * programu Digital Innovation Hubs. Wykorzystanie w Consultify służy celom edukacyjnym.
 * 
 * Structure:
 * - 5 Pillars (Strategy, Smart Products, Smart Operations, Smart Supply Chain, Data-Driven)
 * - 12 Dimensions across pillars
 * - Scale: 1-5
 */

import { FrameworkDimension, FrameworkLevel } from './frameworkRegistry';

// ============================================
// TYPES
// ============================================

export type ADMAPillarId = 'strategy' | 'smart_products' | 'smart_operations' | 'smart_supply' | 'data_driven';

export interface ADMALevel extends FrameworkLevel {
    level: number; // 1-5
    title: string;
    description: string;
    characteristics?: string[];
}

export interface ADMADimension extends FrameworkDimension {
    id: string;
    name: string;
    namePL: string;
    pillar: ADMAPillarId;
    description: string;
    levels: ADMALevel[];
}

export interface ADMAPillarConfig {
    id: ADMAPillarId;
    name: string;
    namePL: string;
    description: string;
    descriptionPL: string;
    color: string;
    icon: string;
    dimensionIds: string[];
}

export interface ADMAAssessmentData {
    pillars: Record<ADMAPillarId, ADMAPillarScore>;
    dimensions: Record<string, ADMADimensionScore>;
    overallMaturity: number;
    metadata: {
        assessmentDate: string;
        version: string;
        source: 'manual' | 'imported';
    };
}

export interface ADMAPillarScore {
    current: number;
    target: number;
    gap: number;
    dimensionScores: Record<string, number>;
}

export interface ADMADimensionScore {
    current: number;
    target: number;
    gap: number;
    evidence?: string;
}

// ============================================
// MATURITY LEVELS (Universal for all dimensions)
// ============================================

export const ADMA_MATURITY_LEVELS: ADMALevel[] = [
    {
        level: 1,
        title: 'Newcomer',
        description: 'No or very limited digital capabilities. Traditional methods dominate.',
        characteristics: [
            'No digital strategy',
            'Manual processes',
            'No data collection',
            'Siloed operations',
        ],
    },
    {
        level: 2,
        title: 'Beginner',
        description: 'Initial digital initiatives. Some awareness and pilot projects.',
        characteristics: [
            'Basic digital awareness',
            'Isolated digital tools',
            'Some data collection',
            'Limited integration',
        ],
    },
    {
        level: 3,
        title: 'Intermediate',
        description: 'Digital technologies integrated in key areas. Data-driven decisions emerging.',
        characteristics: [
            'Digital strategy defined',
            'Core processes digitized',
            'Data analytics in use',
            'Cross-functional integration',
        ],
    },
    {
        level: 4,
        title: 'Experienced',
        description: 'Advanced digital integration. Predictive capabilities and automation.',
        characteristics: [
            'Digital-first mindset',
            'Automated workflows',
            'Predictive analytics',
            'Ecosystem collaboration',
        ],
    },
    {
        level: 5,
        title: 'Expert',
        description: 'Digital leader. AI-driven operations with continuous innovation.',
        characteristics: [
            'Digital innovation leader',
            'AI/ML pervasive',
            'Real-time optimization',
            'Digital business models',
        ],
    },
];

// ============================================
// PILLARS CONFIGURATION
// ============================================

export const ADMA_PILLARS: Record<ADMAPillarId, ADMAPillarConfig> = {
    strategy: {
        id: 'strategy',
        name: 'Strategy & Organization',
        namePL: 'Strategia i Organizacja',
        description: 'Digital strategy alignment with business goals and organizational readiness',
        descriptionPL: 'Zgodność strategii cyfrowej z celami biznesowymi i gotowość organizacyjna',
        color: 'blue',
        icon: 'Target',
        dimensionIds: ['digital_strategy', 'digital_investments', 'digital_culture'],
    },
    smart_products: {
        id: 'smart_products',
        name: 'Smart Products',
        namePL: 'Inteligentne Produkty',
        description: 'Product digitalization, IoT integration, and servitization',
        descriptionPL: 'Cyfryzacja produktów, integracja IoT i serwicyzacja',
        color: 'green',
        icon: 'Cpu',
        dimensionIds: ['product_features', 'product_data'],
    },
    smart_operations: {
        id: 'smart_operations',
        name: 'Smart Operations',
        namePL: 'Inteligentne Operacje',
        description: 'Production process optimization and manufacturing excellence',
        descriptionPL: 'Optymalizacja procesów produkcyjnych i doskonałość wytwarzania',
        color: 'purple',
        icon: 'Settings',
        dimensionIds: ['production_tech', 'production_it'],
    },
    smart_supply: {
        id: 'smart_supply',
        name: 'Smart Supply Chain',
        namePL: 'Inteligentny Łańcuch Dostaw',
        description: 'Supply chain digitalization and visibility',
        descriptionPL: 'Cyfryzacja łańcucha dostaw i widoczność',
        color: 'orange',
        icon: 'Truck',
        dimensionIds: ['supply_integration', 'supply_visibility'],
    },
    data_driven: {
        id: 'data_driven',
        name: 'Data-Driven Services',
        namePL: 'Usługi Oparte na Danych',
        description: 'Data monetization, analytics, and value creation',
        descriptionPL: 'Monetyzacja danych, analityka i tworzenie wartości',
        color: 'cyan',
        icon: 'Database',
        dimensionIds: ['data_collection', 'data_analytics', 'data_services'],
    },
};

// ============================================
// DIMENSIONS
// ============================================

export const ADMA_DIMENSIONS: ADMADimension[] = [
    // Strategy & Organization
    {
        id: 'digital_strategy',
        name: 'Digital Strategy',
        namePL: 'Strategia Cyfrowa',
        pillar: 'strategy',
        description: 'Existence and maturity of digital transformation strategy',
        levels: ADMA_MATURITY_LEVELS,
    },
    {
        id: 'digital_investments',
        name: 'Digital Investments',
        namePL: 'Inwestycje Cyfrowe',
        pillar: 'strategy',
        description: 'Budget allocation and ROI tracking for digital initiatives',
        levels: ADMA_MATURITY_LEVELS,
    },
    {
        id: 'digital_culture',
        name: 'Digital Culture',
        namePL: 'Kultura Cyfrowa',
        pillar: 'strategy',
        description: 'Organizational readiness, skills, and digital mindset',
        levels: ADMA_MATURITY_LEVELS,
    },
    
    // Smart Products
    {
        id: 'product_features',
        name: 'Smart Product Features',
        namePL: 'Funkcje Inteligentnych Produktów',
        pillar: 'smart_products',
        description: 'Connected features, sensors, and digital capabilities in products',
        levels: ADMA_MATURITY_LEVELS,
    },
    {
        id: 'product_data',
        name: 'Product Data Usage',
        namePL: 'Wykorzystanie Danych Produktu',
        pillar: 'smart_products',
        description: 'Collection and utilization of product usage data',
        levels: ADMA_MATURITY_LEVELS,
    },
    
    // Smart Operations
    {
        id: 'production_tech',
        name: 'Production Technologies',
        namePL: 'Technologie Produkcyjne',
        pillar: 'smart_operations',
        description: 'Advanced manufacturing technologies and automation',
        levels: ADMA_MATURITY_LEVELS,
    },
    {
        id: 'production_it',
        name: 'Production IT',
        namePL: 'IT Produkcyjne',
        pillar: 'smart_operations',
        description: 'MES, SCADA, and IT/OT integration',
        levels: ADMA_MATURITY_LEVELS,
    },
    
    // Smart Supply Chain
    {
        id: 'supply_integration',
        name: 'Supply Chain Integration',
        namePL: 'Integracja Łańcucha Dostaw',
        pillar: 'smart_supply',
        description: 'Digital integration with suppliers and customers',
        levels: ADMA_MATURITY_LEVELS,
    },
    {
        id: 'supply_visibility',
        name: 'Supply Chain Visibility',
        namePL: 'Widoczność Łańcucha Dostaw',
        pillar: 'smart_supply',
        description: 'Real-time visibility and traceability',
        levels: ADMA_MATURITY_LEVELS,
    },
    
    // Data-Driven Services
    {
        id: 'data_collection',
        name: 'Data Collection',
        namePL: 'Zbieranie Danych',
        pillar: 'data_driven',
        description: 'Systematic data collection and storage',
        levels: ADMA_MATURITY_LEVELS,
    },
    {
        id: 'data_analytics',
        name: 'Data Analytics',
        namePL: 'Analityka Danych',
        pillar: 'data_driven',
        description: 'Analytics capabilities from descriptive to prescriptive',
        levels: ADMA_MATURITY_LEVELS,
    },
    {
        id: 'data_services',
        name: 'Data-Based Services',
        namePL: 'Usługi Oparte na Danych',
        pillar: 'data_driven',
        description: 'New services and revenue streams from data',
        levels: ADMA_MATURITY_LEVELS,
    },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get dimension by ID
 */
export function getADMADimension(dimensionId: string): ADMADimension | undefined {
    return ADMA_DIMENSIONS.find(d => d.id === dimensionId);
}

/**
 * Get dimensions for a pillar
 */
export function getDimensionsForPillar(pillarId: ADMAPillarId): ADMADimension[] {
    return ADMA_DIMENSIONS.filter(d => d.pillar === pillarId);
}

/**
 * Get all pillar IDs
 */
export function getAllPillarIds(): ADMAPillarId[] {
    return Object.keys(ADMA_PILLARS) as ADMAPillarId[];
}

/**
 * Calculate pillar score from dimension scores
 */
export function calculatePillarScore(dimensionScores: Record<string, number>, pillarId: ADMAPillarId): number {
    const pillarConfig = ADMA_PILLARS[pillarId];
    const relevantScores = pillarConfig.dimensionIds
        .map(id => dimensionScores[id])
        .filter(score => score !== undefined && score !== null && score > 0);
    
    if (relevantScores.length === 0) return 0;
    return Math.round((relevantScores.reduce((a, b) => a + b, 0) / relevantScores.length) * 10) / 10;
}

/**
 * Calculate overall ADMA maturity score
 */
export function calculateOverallADMAScore(dimensionScores: Record<string, number>): number {
    const allScores = Object.values(dimensionScores).filter(s => s !== undefined && s !== null && s > 0);
    if (allScores.length === 0) return 0;
    return Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10;
}

/**
 * Map ADMA dimension to DRD axis for initiative generation
 */
export function mapADMADimensionToDRD(dimensionId: string): string {
    const mapping: Record<string, string> = {
        'digital_strategy': 'businessModels',
        'digital_investments': 'businessModels',
        'digital_culture': 'culture',
        'product_features': 'digitalProducts',
        'product_data': 'dataManagement',
        'production_tech': 'processes',
        'production_it': 'processes',
        'supply_integration': 'processes',
        'supply_visibility': 'dataManagement',
        'data_collection': 'dataManagement',
        'data_analytics': 'aiMaturity',
        'data_services': 'digitalProducts',
    };
    return mapping[dimensionId] || 'processes';
}

/**
 * Create empty ADMA assessment data
 */
export function createEmptyADMAAssessment(): ADMAAssessmentData {
    const pillars: Record<ADMAPillarId, ADMAPillarScore> = {} as Record<ADMAPillarId, ADMAPillarScore>;
    getAllPillarIds().forEach(pillarId => {
        pillars[pillarId] = { current: 0, target: 0, gap: 0, dimensionScores: {} };
    });
    
    const dimensions: Record<string, ADMADimensionScore> = {};
    ADMA_DIMENSIONS.forEach(dim => {
        dimensions[dim.id] = { current: 0, target: 0, gap: 0 };
    });
    
    return {
        pillars,
        dimensions,
        overallMaturity: 0,
        metadata: {
            assessmentDate: new Date().toISOString(),
            version: '2.0',
            source: 'manual',
        },
    };
}

/**
 * Get radar chart data for 5 pillars
 */
export function getPillarRadarData(pillarScores: Record<ADMAPillarId, ADMAPillarScore>): {
    labels: string[];
    current: number[];
    target: number[];
} {
    const pillarIds = getAllPillarIds();
    return {
        labels: pillarIds.map(id => ADMA_PILLARS[id].namePL),
        current: pillarIds.map(id => pillarScores[id]?.current || 0),
        target: pillarIds.map(id => pillarScores[id]?.target || 0),
    };
}

export default {
    ADMA_PILLARS,
    ADMA_DIMENSIONS,
    ADMA_MATURITY_LEVELS,
};









