/**
 * Framework Assessment Service
 * 
 * Centralized service for managing multi-framework assessments:
 * - DRD, SIRI, ADMA, CMMI, LEAN (DBR77)
 * - Score normalization and mapping
 * - Initiative generation from any framework
 */

import { v4 as uuidv4 } from 'uuid';



// =====================================================
// FRAMEWORK CONFIGURATIONS
// =====================================================

const FRAMEWORK_CONFIGS = {
    DRD: {
        scaleMin: 1,
        scaleMax: 7,
        dimensions: 7,
        supportsImport: false
    },
    SIRI: {
        scaleMin: 0,
        scaleMax: 5,
        dimensions: 8,
        supportsImport: true
    },
    ADMA: {
        scaleMin: 1,
        scaleMax: 5,
        dimensions: 12,
        supportsImport: true
    },
    CMMI: {
        scaleMin: 1,
        scaleMax: 5,
        dimensions: 20,
        supportsImport: true
    },
    LEAN: {
        scaleMin: 1,
        scaleMax: 5,
        dimensions: null, // Dynamic based on processes/workstations
        supportsImport: false
    }
};

// =====================================================
// SCORE NORMALIZATION
// =====================================================

/**
 * Normalize score from one scale to another
 * @param {number} score - Original score
 * @param {number} fromMin - Source scale minimum
 * @param {number} fromMax - Source scale maximum
 * @param {number} toMin - Target scale minimum
 * @param {number} toMax - Target scale maximum
 * @returns {number} Normalized score
 */
function normalizeScore(score, fromMin, fromMax, toMin, toMax) {
    if (fromMax === fromMin) return toMin;
    const normalized = ((score - fromMin) / (fromMax - fromMin)) * (toMax - toMin) + toMin;
    return Math.round(normalized * 10) / 10;
}

/**
 * Map framework score to DRD scale (1-7)
 * @param {string} framework - Framework ID
 * @param {number} score - Original score
 * @returns {number} Score in DRD scale (1-7)
 */
function mapToDRDScale(framework, score) {
    const config = FRAMEWORK_CONFIGS[framework];
    if (!config) {
        throw new Error(`Unknown framework: ${framework}`);
    }
    return normalizeScore(score, config.scaleMin, config.scaleMax, 1, 7);
}

/**
 * Map DRD score to target framework scale
 * @param {string} framework - Target framework ID
 * @param {number} drdScore - Score in DRD scale (1-7)
 * @returns {number} Score in target framework scale
 */
function mapFromDRDScale(framework, drdScore) {
    const config = FRAMEWORK_CONFIGS[framework];
    if (!config) {
        throw new Error(`Unknown framework: ${framework}`);
    }
    return normalizeScore(drdScore, 1, 7, config.scaleMin, config.scaleMax);
}

// =====================================================
// DRD AXIS MAPPING
// =====================================================

/**
 * Mapping from framework dimensions to DRD axes
 */
const DIMENSION_TO_DRD_MAPPING = {
    // SIRI mappings
    'siri_operations': 'processes',
    'siri_supply_chain': 'processes',
    'siri_product_lifecycle': 'digitalProducts',
    'siri_automation': 'processes',
    'siri_connectivity': 'dataManagement',
    'siri_intelligence': 'aiMaturity',
    'siri_talent_readiness': 'culture',
    'siri_structure_management': 'culture',
    
    // ADMA mappings
    'adma_digital_strategy': 'businessModels',
    'adma_digital_investments': 'businessModels',
    'adma_digital_culture': 'culture',
    'adma_product_features': 'digitalProducts',
    'adma_product_data': 'dataManagement',
    'adma_production_tech': 'processes',
    'adma_production_it': 'processes',
    'adma_supply_integration': 'processes',
    'adma_supply_visibility': 'dataManagement',
    'adma_data_collection': 'dataManagement',
    'adma_data_analytics': 'aiMaturity',
    'adma_data_services': 'digitalProducts',
    
    // CMMI mappings
    'cmmi_EST': 'processes',
    'cmmi_PAD': 'processes',
    'cmmi_MC': 'processes',
    'cmmi_PI': 'processes',
    'cmmi_PQA': 'processes',
    'cmmi_RDM': 'digitalProducts',
    'cmmi_RM': 'processes',
    'cmmi_TS': 'digitalProducts',
    'cmmi_VER': 'processes',
    'cmmi_VAL': 'processes',
    'cmmi_CAR': 'dataManagement',
    'cmmi_CM': 'processes',
    'cmmi_DAR': 'businessModels',
    'cmmi_RSKM': 'processes',
    'cmmi_SAM': 'processes',
    'cmmi_GOV': 'culture',
    'cmmi_II': 'processes',
    'cmmi_OT': 'culture',
    'cmmi_PCM': 'processes',
    'cmmi_MPM': 'dataManagement'
};

/**
 * Map framework dimension to DRD axis
 * @param {string} framework - Framework ID
 * @param {string} dimensionId - Dimension ID within framework
 * @returns {string} DRD axis ID
 */
function mapDimensionToDRDAxis(framework, dimensionId) {
    const mappingKey = `${framework.toLowerCase()}_${dimensionId}`;
    return DIMENSION_TO_DRD_MAPPING[mappingKey] || 'processes';
}

// =====================================================
// ASSESSMENT AGGREGATION
// =====================================================

/**
 * Calculate overall maturity from framework-specific data
 * @param {string} framework - Framework ID
 * @param {Object} data - Framework-specific assessment data
 * @returns {number} Overall maturity score
 */
function calculateOverallMaturity(framework, data) {
    switch (framework) {
        case 'DRD':
            // Average of all axes
            const drdScores = Object.values(data.axes || {})
                .map(axis => axis.score)
                .filter(s => s !== undefined && s !== null);
            return drdScores.length > 0
                ? drdScores.reduce((a, b) => a + b, 0) / drdScores.length
                : 0;
            
        case 'SIRI':
            return data.overallScore || 0;
            
        case 'ADMA':
            return data.overallMaturity || 0;
            
        case 'CMMI':
            return data.maturityLevel || 1;
            
        case 'LEAN':
            // Average of Lean maturity and automation potential
            const leanMaturity = data.summary?.avgLeanMaturity || 0;
            const autoPotential = data.summary?.avgAutomationPotential || 0;
            return (leanMaturity + autoPotential) / 2;
            
        default:
            return 0;
    }
}

/**
 * Calculate gap analysis for framework assessment
 * @param {string} framework - Framework ID
 * @param {Object} data - Framework-specific assessment data
 * @param {number} targetLevel - Target maturity level
 * @returns {Array} Array of gaps
 */
function calculateGaps(framework, data, targetLevel = null) {
    const gaps = [];
    const config = FRAMEWORK_CONFIGS[framework];
    const target = targetLevel || config.scaleMax;
    
    switch (framework) {
        case 'SIRI':
            if (data.dimensions) {
                Object.entries(data.dimensions).forEach(([dimId, dimData]) => {
                    const gap = target - (dimData.current || 0);
                    if (gap > 0) {
                        gaps.push({
                            dimensionId: dimId,
                            current: dimData.current || 0,
                            target,
                            gap,
                            drdAxis: mapDimensionToDRDAxis('SIRI', dimId)
                        });
                    }
                });
            }
            break;
            
        case 'ADMA':
            if (data.dimensions) {
                Object.entries(data.dimensions).forEach(([dimId, dimData]) => {
                    const gap = target - (dimData.current || 0);
                    if (gap > 0) {
                        gaps.push({
                            dimensionId: dimId,
                            current: dimData.current || 0,
                            target,
                            gap,
                            drdAxis: mapDimensionToDRDAxis('ADMA', dimId)
                        });
                    }
                });
            }
            break;
            
        case 'CMMI':
            if (data.practiceAreas) {
                Object.entries(data.practiceAreas).forEach(([paId, paData]) => {
                    const gap = target - (paData.level || 0);
                    if (gap > 0) {
                        gaps.push({
                            dimensionId: paId,
                            current: paData.level || 0,
                            target,
                            gap,
                            drdAxis: mapDimensionToDRDAxis('CMMI', paId)
                        });
                    }
                });
            }
            break;
            
        case 'LEAN':
            // Gaps based on wastes and automation potential
            if (data.processes) {
                data.processes.forEach(process => {
                    if (process.automationPotential?.feasibility >= 3) {
                        gaps.push({
                            dimensionId: `process_${process.id}`,
                            type: 'automation',
                            current: 0,
                            target: process.automationPotential.feasibility,
                            gap: process.automationPotential.feasibility,
                            savings: process.automationPotential.estimatedSavings || 0,
                            drdAxis: 'processes'
                        });
                    }
                });
            }
            break;
    }
    
    // Sort by gap (largest first)
    return gaps.sort((a, b) => b.gap - a.gap);
}

// =====================================================
// INITIATIVE GENERATION
// =====================================================

/**
 * Generate initiative suggestions from framework gaps
 * @param {string} framework - Framework ID
 * @param {Array} gaps - Gap analysis results
 * @returns {Array} Initiative suggestions
 */
function generateInitiativeSuggestions(framework, gaps) {
    const initiatives = [];
    
    gaps.forEach((gap, index) => {
        // Only generate initiatives for significant gaps
        if (gap.gap < 1) return;
        
        const initiative = {
            id: uuidv4(),
            title: getInitiativeTitle(framework, gap),
            description: getInitiativeDescription(framework, gap),
            priority: getPriorityFromGap(gap.gap),
            effort: getEffortEstimate(gap.gap),
            impact: getImpactEstimate(gap.gap),
            drdAxis: gap.drdAxis,
            sourceFramework: framework,
            sourceDimension: gap.dimensionId,
            targetScore: gap.target,
            currentScore: gap.current
        };
        
        initiatives.push(initiative);
    });
    
    return initiatives.slice(0, 10); // Top 10 initiatives
}

/**
 * Generate initiative title based on framework and gap
 */
function getInitiativeTitle(framework, gap) {
    const titles = {
        SIRI: {
            operations: 'Optymalizacja procesów operacyjnych Industry 4.0',
            supply_chain: 'Cyfryzacja łańcucha dostaw',
            automation: 'Wdrożenie automatyzacji produkcji',
            connectivity: 'Integracja systemów IT/OT',
            intelligence: 'Wdrożenie analityki predykcyjnej',
            talent_readiness: 'Program rozwoju kompetencji cyfrowych'
        },
        ADMA: {
            digital_strategy: 'Opracowanie strategii cyfrowej transformacji',
            production_tech: 'Modernizacja technologii produkcyjnych',
            data_analytics: 'Wdrożenie zaawansowanej analityki'
        },
        CMMI: {
            EST: 'Wdrożenie metodologii szacowania',
            PAD: 'Standaryzacja procesów planowania',
            RSKM: 'Wdrożenie zarządzania ryzykiem'
        }
    };
    
    return titles[framework]?.[gap.dimensionId] || 
        `Poprawa ${gap.dimensionId} (${framework})`;
}

/**
 * Generate initiative description
 */
function getInitiativeDescription(framework, gap) {
    return `Inicjatywa mająca na celu podniesienie poziomu ${gap.dimensionId} z ${gap.current} do ${gap.target} ` +
        `w ramach metodologii ${framework}. Luka do zamknięcia: ${gap.gap} punktów.`;
}

/**
 * Determine priority from gap size
 */
function getPriorityFromGap(gap) {
    if (gap >= 3) return 'critical';
    if (gap >= 2) return 'high';
    if (gap >= 1) return 'medium';
    return 'low';
}

/**
 * Estimate effort from gap size
 */
function getEffortEstimate(gap) {
    if (gap >= 3) return 'high';
    if (gap >= 2) return 'medium';
    return 'low';
}

/**
 * Estimate impact from gap size
 */
function getImpactEstimate(gap) {
    if (gap >= 3) return 'high';
    if (gap >= 2) return 'medium';
    return 'low';
}

// =====================================================
// EXPORTS
// =====================================================

export default {
    FRAMEWORK_CONFIGS,
    normalizeScore,
    mapToDRDScale,
    mapFromDRDScale,
    mapDimensionToDRDAxis,
    calculateOverallMaturity,
    calculateGaps,
    generateInitiativeSuggestions
};








