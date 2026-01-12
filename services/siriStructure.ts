/**
 * SIRI (Smart Industry Readiness Index) Structure
 *
 * SIRI jest narzędziem opracowanym przez Singapore Economic Development Board (EDB)
 * we współpracy z TÜV SÜD. Wykorzystanie w Consultify ma wyłącznie cel edukacyjny.
 *
 * Structure:
 * - 3 Building Blocks (Process, Technology, Organization)
 * - 8 Dimensions across blocks
 * - 16 Prioritisation Areas
 * - Scale: 0-5 (0 = Not Started)
 */

import { FrameworkDimension, FrameworkLevel } from './frameworkRegistry';

// ============================================
// TYPES
// ============================================

export type SIRIBuildingBlock = 'PROCESS' | 'TECHNOLOGY' | 'ORGANIZATION';

export interface SIRILevel extends FrameworkLevel {
    level: number; // 0-5
    title: string;
    description: string;
    indicators?: string[];
}

export interface SIRIDimension extends FrameworkDimension {
    id: string;
    name: string;
    buildingBlock: SIRIBuildingBlock;
    description: string;
    levels: SIRILevel[];
    prioritisationAreas: string[];
}

export interface SIRIBuildingBlockConfig {
    id: SIRIBuildingBlock;
    name: string;
    namePL: string;
    description: string;
    color: string;
    icon: string;
    dimensionIds: string[];
}

export interface SIRIPrioritisationArea {
    id: string;
    name: string;
    namePL: string;
    buildingBlock: SIRIBuildingBlock;
    dimension: string;
    description: string;
}

export interface SIRIAssessmentData {
    buildingBlocks: Record<SIRIBuildingBlock, SIRIBlockScore>;
    dimensions: Record<string, SIRIDimensionScore>;
    prioritisationMatrix: Record<string, number>;
    overallScore: number;
    metadata: {
        assessmentDate: string;
        version: string;
        source: 'manual' | 'imported';
    };
}

export interface SIRIBlockScore {
    score: number;
    target?: number;
    dimensionScores: Record<string, number>;
}

export interface SIRIDimensionScore {
    current: number;
    target: number;
    gap: number;
    areaScores?: Record<string, number>;
}

// ============================================
// BUILDING BLOCKS CONFIGURATION
// ============================================

export const SIRI_BUILDING_BLOCKS: Record<SIRIBuildingBlock, SIRIBuildingBlockConfig> = {
    PROCESS: {
        id: 'PROCESS',
        name: 'Process',
        namePL: 'Procesy',
        description: 'How operations are designed, managed and optimized across the value chain',
        color: 'blue',
        icon: 'Settings',
        dimensionIds: ['operations', 'supply_chain', 'product_lifecycle'],
    },
    TECHNOLOGY: {
        id: 'TECHNOLOGY',
        name: 'Technology',
        namePL: 'Technologia',
        description: 'How technology enables smart manufacturing through automation, connectivity and intelligence',
        color: 'green',
        icon: 'Cpu',
        dimensionIds: ['automation', 'connectivity', 'intelligence'],
    },
    ORGANIZATION: {
        id: 'ORGANIZATION',
        name: 'Organization',
        namePL: 'Organizacja',
        description: 'How people and organizational structure support Industry 4.0 transformation',
        color: 'purple',
        icon: 'Users',
        dimensionIds: ['talent_readiness', 'structure_management'],
    },
};

// ============================================
// MATURITY LEVELS (Universal for all dimensions)
// ============================================

export const SIRI_MATURITY_LEVELS: SIRILevel[] = [
    {
        level: 0,
        title: 'Not Started',
        description: 'No initiatives or plans in place. Traditional methods dominate.',
        indicators: [
            'No awareness of Industry 4.0 concepts',
            'Manual, paper-based processes',
            'No digital tools or connectivity',
        ],
    },
    {
        level: 1,
        title: 'Defined',
        description: 'Basic awareness and initial planning. Some pilot projects may exist.',
        indicators: [
            'Awareness of Industry 4.0 benefits',
            'Initial planning and roadmapping',
            'Isolated pilot projects',
        ],
    },
    {
        level: 2,
        title: 'Digital',
        description: 'Digital technologies implemented in silos. Data collection started.',
        indicators: ['Standalone digital systems', 'Basic data collection', 'Some process digitization'],
    },
    {
        level: 3,
        title: 'Integrated',
        description: 'Systems connected across functions. Real-time visibility achieved.',
        indicators: [
            'Systems integration across departments',
            'Real-time data visibility',
            'Cross-functional collaboration',
        ],
    },
    {
        level: 4,
        title: 'Automated',
        description: 'Automated decision-making with AI/ML. Predictive capabilities.',
        indicators: ['AI-driven automation', 'Predictive analytics', 'Self-adjusting processes'],
    },
    {
        level: 5,
        title: 'Intelligent',
        description: 'Self-optimizing autonomous operations. Continuous improvement loop.',
        indicators: ['Autonomous operations', 'Self-learning systems', 'Ecosystem-wide optimization'],
    },
];

// ============================================
// DIMENSIONS
// ============================================

export const SIRI_DIMENSIONS: SIRIDimension[] = [
    // PROCESS Building Block
    {
        id: 'operations',
        name: 'Operations',
        buildingBlock: 'PROCESS',
        description: 'Shop floor production processes, quality management, and operational efficiency',
        levels: SIRI_MATURITY_LEVELS,
        prioritisationAreas: ['vertical_integration', 'shop_floor_operations'],
    },
    {
        id: 'supply_chain',
        name: 'Supply Chain',
        buildingBlock: 'PROCESS',
        description: 'End-to-end supply chain visibility, planning, and execution',
        levels: SIRI_MATURITY_LEVELS,
        prioritisationAreas: ['horizontal_integration', 'supply_chain_visibility'],
    },
    {
        id: 'product_lifecycle',
        name: 'Product Lifecycle',
        buildingBlock: 'PROCESS',
        description: 'Product design, development, and lifecycle management',
        levels: SIRI_MATURITY_LEVELS,
        prioritisationAreas: ['integrated_product_lifecycle', 'digital_twin'],
    },

    // TECHNOLOGY Building Block
    {
        id: 'automation',
        name: 'Automation',
        buildingBlock: 'TECHNOLOGY',
        description: 'Level of automation in production, logistics, and support functions',
        levels: SIRI_MATURITY_LEVELS,
        prioritisationAreas: ['shop_floor_automation', 'enterprise_automation', 'facility_automation'],
    },
    {
        id: 'connectivity',
        name: 'Connectivity',
        buildingBlock: 'TECHNOLOGY',
        description: 'IT/OT integration, IoT deployment, and network infrastructure',
        levels: SIRI_MATURITY_LEVELS,
        prioritisationAreas: ['shop_floor_connectivity', 'enterprise_connectivity', 'facility_connectivity'],
    },
    {
        id: 'intelligence',
        name: 'Intelligence',
        buildingBlock: 'TECHNOLOGY',
        description: 'Analytics, AI/ML, and intelligent decision support systems',
        levels: SIRI_MATURITY_LEVELS,
        prioritisationAreas: ['shop_floor_intelligence', 'enterprise_intelligence', 'facility_intelligence'],
    },

    // ORGANIZATION Building Block
    {
        id: 'talent_readiness',
        name: 'Talent Readiness',
        buildingBlock: 'ORGANIZATION',
        description: 'Workforce skills, learning & development, and talent management',
        levels: SIRI_MATURITY_LEVELS,
        prioritisationAreas: ['workforce_learning', 'leadership_competency'],
    },
    {
        id: 'structure_management',
        name: 'Structure & Management',
        buildingBlock: 'ORGANIZATION',
        description: 'Organizational structure, governance, and collaboration',
        levels: SIRI_MATURITY_LEVELS,
        prioritisationAreas: ['strategy_governance', 'inter_intra_collaboration'],
    },
];

// ============================================
// PRIORITISATION AREAS (16 Areas)
// ============================================

export const SIRI_PRIORITISATION_AREAS: SIRIPrioritisationArea[] = [
    // Process
    {
        id: 'vertical_integration',
        name: 'Vertical Integration',
        namePL: 'Integracja Pionowa',
        buildingBlock: 'PROCESS',
        dimension: 'operations',
        description: 'Integration from shop floor to enterprise systems',
    },
    {
        id: 'horizontal_integration',
        name: 'Horizontal Integration',
        namePL: 'Integracja Pozioma',
        buildingBlock: 'PROCESS',
        dimension: 'supply_chain',
        description: 'Integration across the value chain with partners',
    },
    {
        id: 'integrated_product_lifecycle',
        name: 'Integrated Product Lifecycle',
        namePL: 'Zintegrowany Cykl Życia Produktu',
        buildingBlock: 'PROCESS',
        dimension: 'product_lifecycle',
        description: 'End-to-end product lifecycle management',
    },

    // Technology - Automation
    {
        id: 'shop_floor_automation',
        name: 'Shop Floor Automation',
        namePL: 'Automatyzacja Produkcji',
        buildingBlock: 'TECHNOLOGY',
        dimension: 'automation',
        description: 'Robotics, CNC, automated material handling',
    },
    {
        id: 'enterprise_automation',
        name: 'Enterprise Automation',
        namePL: 'Automatyzacja Przedsiębiorstwa',
        buildingBlock: 'TECHNOLOGY',
        dimension: 'automation',
        description: 'Business process automation, RPA',
    },
    {
        id: 'facility_automation',
        name: 'Facility Automation',
        namePL: 'Automatyzacja Obiektów',
        buildingBlock: 'TECHNOLOGY',
        dimension: 'automation',
        description: 'Building management, energy optimization',
    },

    // Technology - Connectivity
    {
        id: 'shop_floor_connectivity',
        name: 'Shop Floor Connectivity',
        namePL: 'Łączność Produkcji',
        buildingBlock: 'TECHNOLOGY',
        dimension: 'connectivity',
        description: 'OT networks, IIoT sensors, edge computing',
    },
    {
        id: 'enterprise_connectivity',
        name: 'Enterprise Connectivity',
        namePL: 'Łączność Przedsiębiorstwa',
        buildingBlock: 'TECHNOLOGY',
        dimension: 'connectivity',
        description: 'IT infrastructure, cloud, ERP integration',
    },
    {
        id: 'facility_connectivity',
        name: 'Facility Connectivity',
        namePL: 'Łączność Obiektów',
        buildingBlock: 'TECHNOLOGY',
        dimension: 'connectivity',
        description: 'Smart building systems, utilities monitoring',
    },

    // Technology - Intelligence
    {
        id: 'shop_floor_intelligence',
        name: 'Shop Floor Intelligence',
        namePL: 'Inteligencja Produkcji',
        buildingBlock: 'TECHNOLOGY',
        dimension: 'intelligence',
        description: 'Predictive maintenance, quality AI, process optimization',
    },
    {
        id: 'enterprise_intelligence',
        name: 'Enterprise Intelligence',
        namePL: 'Inteligencja Przedsiębiorstwa',
        buildingBlock: 'TECHNOLOGY',
        dimension: 'intelligence',
        description: 'Business analytics, demand forecasting, supply chain AI',
    },
    {
        id: 'facility_intelligence',
        name: 'Facility Intelligence',
        namePL: 'Inteligencja Obiektów',
        buildingBlock: 'TECHNOLOGY',
        dimension: 'intelligence',
        description: 'Energy AI, space optimization, sustainability analytics',
    },

    // Organization
    {
        id: 'workforce_learning',
        name: 'Workforce Learning & Development',
        namePL: 'Rozwój i Szkolenia Pracowników',
        buildingBlock: 'ORGANIZATION',
        dimension: 'talent_readiness',
        description: 'Digital skills training, reskilling programs',
    },
    {
        id: 'leadership_competency',
        name: 'Leadership Competency',
        namePL: 'Kompetencje Liderów',
        buildingBlock: 'ORGANIZATION',
        dimension: 'talent_readiness',
        description: 'Digital leadership, change management skills',
    },
    {
        id: 'strategy_governance',
        name: 'Strategy & Governance',
        namePL: 'Strategia i Governance',
        buildingBlock: 'ORGANIZATION',
        dimension: 'structure_management',
        description: 'Digital strategy, governance frameworks',
    },
    {
        id: 'inter_intra_collaboration',
        name: 'Inter & Intra Company Collaboration',
        namePL: 'Współpraca Wewnętrzna i Zewnętrzna',
        buildingBlock: 'ORGANIZATION',
        dimension: 'structure_management',
        description: 'Cross-functional teams, ecosystem partnerships',
    },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get dimension by ID
 */
export function getSIRIDimension(dimensionId: string): SIRIDimension | undefined {
    return SIRI_DIMENSIONS.find((d) => d.id === dimensionId);
}

/**
 * Get dimensions for a building block
 */
export function getDimensionsForBlock(block: SIRIBuildingBlock): SIRIDimension[] {
    return SIRI_DIMENSIONS.filter((d) => d.buildingBlock === block);
}

/**
 * Get prioritisation areas for a dimension
 */
export function getPrioritisationAreasForDimension(dimensionId: string): SIRIPrioritisationArea[] {
    return SIRI_PRIORITISATION_AREAS.filter((a) => a.dimension === dimensionId);
}

/**
 * Get prioritisation areas for a building block
 */
export function getPrioritisationAreasForBlock(block: SIRIBuildingBlock): SIRIPrioritisationArea[] {
    return SIRI_PRIORITISATION_AREAS.filter((a) => a.buildingBlock === block);
}

/**
 * Calculate building block score from dimension scores
 */
export function calculateBlockScore(dimensionScores: Record<string, number>, block: SIRIBuildingBlock): number {
    const blockConfig = SIRI_BUILDING_BLOCKS[block];
    const relevantScores = blockConfig.dimensionIds
        .map((id) => dimensionScores[id])
        .filter((score) => score !== undefined && score !== null);

    if (relevantScores.length === 0) return 0;
    return Math.round((relevantScores.reduce((a, b) => a + b, 0) / relevantScores.length) * 10) / 10;
}

/**
 * Calculate overall SIRI score
 */
export function calculateOverallSIRIScore(dimensionScores: Record<string, number>): number {
    const allScores = Object.values(dimensionScores).filter((s) => s !== undefined && s !== null);
    if (allScores.length === 0) return 0;
    return Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10;
}

/**
 * Map SIRI dimension to DRD axis for initiative generation
 */
export function mapSIRIDimensionToDRD(dimensionId: string): string {
    const mapping: Record<string, string> = {
        operations: 'processes',
        supply_chain: 'processes',
        product_lifecycle: 'digitalProducts',
        automation: 'processes',
        connectivity: 'dataManagement',
        intelligence: 'aiMaturity',
        talent_readiness: 'culture',
        structure_management: 'culture',
    };
    return mapping[dimensionId] || 'processes';
}

/**
 * Create empty SIRI assessment data
 */
export function createEmptySIRIAssessment(): SIRIAssessmentData {
    const dimensions: Record<string, SIRIDimensionScore> = {};
    SIRI_DIMENSIONS.forEach((dim) => {
        dimensions[dim.id] = { current: 0, target: 0, gap: 0 };
    });

    const prioritisationMatrix: Record<string, number> = {};
    SIRI_PRIORITISATION_AREAS.forEach((area) => {
        prioritisationMatrix[area.id] = 0;
    });

    return {
        buildingBlocks: {
            PROCESS: { score: 0, dimensionScores: {} },
            TECHNOLOGY: { score: 0, dimensionScores: {} },
            ORGANIZATION: { score: 0, dimensionScores: {} },
        },
        dimensions,
        prioritisationMatrix,
        overallScore: 0,
        metadata: {
            assessmentDate: new Date().toISOString(),
            version: '2.0',
            source: 'manual',
        },
    };
}

export default {
    SIRI_BUILDING_BLOCKS,
    SIRI_DIMENSIONS,
    SIRI_PRIORITISATION_AREAS,
    SIRI_MATURITY_LEVELS,
};

