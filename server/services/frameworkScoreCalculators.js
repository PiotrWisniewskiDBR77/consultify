/**
 * Framework Score Calculators
 * 
 * Calculates overall and category scores for each assessment framework:
 * - SIRI: Building block averages (Process, Technology, Organization)
 * - ADMA: Pillar weighted averages (5 pillars)
 * - CMMI: Minimum practice area level (capability-based)
 * - LEAN: Process + workstation aggregation with automation potential
 */

// ============================================
// FRAMEWORK CONFIGURATIONS
// ============================================

const FRAMEWORK_CONFIG = {
    SIRI: {
        scale: { min: 0, max: 5 },
        buildingBlocks: {
            PROCESS: {
                name: 'Process',
                dimensions: ['operations', 'supply_chain', 'product_lifecycle'],
                weight: 0.35,
            },
            TECHNOLOGY: {
                name: 'Technology',
                dimensions: ['automation', 'connectivity', 'intelligence'],
                weight: 0.35,
            },
            ORGANIZATION: {
                name: 'Organization',
                dimensions: ['talent_readiness', 'structure_management'],
                weight: 0.30,
            },
        },
    },
    ADMA: {
        scale: { min: 1, max: 5 },
        pillars: {
            strategy: { name: 'Strategy & Organization', weight: 0.20 },
            smart_products: { name: 'Smart Products', weight: 0.20 },
            smart_operations: { name: 'Smart Operations', weight: 0.25 },
            smart_supply: { name: 'Smart Supply Chain', weight: 0.20 },
            data_driven: { name: 'Data-Driven Services', weight: 0.15 },
        },
    },
    CMMI: {
        scale: { min: 1, max: 5 },
        levels: {
            1: 'Initial',
            2: 'Managed',
            3: 'Defined',
            4: 'Quantitatively Managed',
            5: 'Optimizing',
        },
        categories: {
            DOING: { name: 'Doing', practiceAreas: ['EST', 'RDM', 'TS', 'PI', 'PR', 'VV'], weight: 0.40 },
            MANAGING: { name: 'Managing', practiceAreas: ['PLAN', 'MC', 'MPM', 'RSK', 'SAM'], weight: 0.35 },
            ENABLING: { name: 'Enabling', practiceAreas: ['CAR', 'CM', 'DAR', 'GOV', 'II', 'OT', 'PAD', 'PCM', 'PPQA'], weight: 0.25 },
        },
    },
    LEAN: {
        scale: { min: 1, max: 5 },
        phases: {
            MEASURE: { name: 'Pomierz', weight: 0.30 },
            OPTIMIZE: { name: 'Zoptymalizuj', weight: 0.40 },
            AUTOMATE: { name: 'Automatyzuj', weight: 0.30 },
        },
    },
};

// ============================================
// SIRI SCORE CALCULATOR
// ============================================

/**
 * Calculate SIRI assessment scores
 * @param {Object} data - SIRI assessment data
 * @returns {Object} { overall, categories, details }
 */
function calculateSIRIScore(data) {
    const config = FRAMEWORK_CONFIG.SIRI;
    const dimensions = data.dimensions || {};
    const categories = {};
    const details = {};

    let totalWeightedScore = 0;
    let totalWeight = 0;

    // Calculate building block scores
    Object.entries(config.buildingBlocks).forEach(([blockId, block]) => {
        const dimensionScores = block.dimensions.map(dimId => {
            const score = dimensions[dimId];
            return typeof score === 'number' ? score : null;
        }).filter(s => s !== null);

        if (dimensionScores.length > 0) {
            const blockScore = dimensionScores.reduce((sum, s) => sum + s, 0) / dimensionScores.length;
            categories[blockId] = Math.round(blockScore * 100) / 100;
            totalWeightedScore += blockScore * block.weight;
            totalWeight += block.weight;

            details[blockId] = {
                name: block.name,
                score: categories[blockId],
                dimensions: block.dimensions.map(dimId => ({
                    id: dimId,
                    score: dimensions[dimId] || 0,
                })),
                completeness: dimensionScores.length / block.dimensions.length,
            };
        }
    });

    // Calculate overall score
    const overall = totalWeight > 0
        ? Math.round((totalWeightedScore / totalWeight) * 100) / 100
        : 0;

    // Calculate prioritization matrix (16 areas)
    const prioritizationMatrix = calculateSIRIPrioritization(dimensions, overall);

    return {
        overall,
        categories,
        details,
        prioritizationMatrix,
        scaleMax: config.scale.max,
        completeness: calculateCompleteness(dimensions, 8), // 8 dimensions in SIRI
    };
}

/**
 * Calculate SIRI prioritization matrix (16 areas)
 */
function calculateSIRIPrioritization(dimensions, overallScore) {
    const areas = {};
    const targetLevel = Math.min(5, Math.ceil(overallScore) + 1);

    Object.entries(dimensions).forEach(([dimId, score]) => {
        const gap = Math.max(0, targetLevel - score);
        const priority = gap > 2 ? 'HIGH' : gap > 1 ? 'MEDIUM' : 'LOW';

        areas[dimId] = {
            current: score,
            target: targetLevel,
            gap,
            priority,
        };
    });

    return areas;
}

// ============================================
// ADMA SCORE CALCULATOR
// ============================================

/**
 * Calculate ADMA assessment scores
 * @param {Object} data - ADMA assessment data
 * @returns {Object} { overall, categories, details }
 */
function calculateADMAScore(data) {
    const config = FRAMEWORK_CONFIG.ADMA;
    const dimensions = data.dimensions || {};
    const categories = {};
    const details = {};

    let totalWeightedScore = 0;
    let totalWeight = 0;
    let completedDimensions = 0;
    let totalDimensions = 0;

    // Map dimensions to pillars
    const pillarDimensions = {
        strategy: ['leadership_strategy', 'investment_innovation', 'digital_culture', 'skills_talent'],
        smart_products: ['connected_products', 'digital_services', 'product_lifecycle'],
        smart_operations: ['digital_manufacturing', 'quality_4_0', 'flexible_production', 'predictive_maintenance'],
        smart_supply: ['e2e_visibility', 'demand_planning', 'smart_logistics'],
        data_driven: ['data_governance', 'analytics_ai', 'data_monetization'],
    };

    // Calculate pillar scores
    Object.entries(config.pillars).forEach(([pillarId, pillar]) => {
        const pillarDims = pillarDimensions[pillarId] || [];
        const dimScores = pillarDims.map(dimId => {
            const score = dimensions[dimId];
            totalDimensions++;
            if (typeof score === 'number' && score > 0) {
                completedDimensions++;
                return score;
            }
            return null;
        }).filter(s => s !== null);

        if (dimScores.length > 0) {
            const pillarScore = dimScores.reduce((sum, s) => sum + s, 0) / dimScores.length;
            categories[pillarId] = Math.round(pillarScore * 100) / 100;
            totalWeightedScore += pillarScore * pillar.weight;
            totalWeight += pillar.weight;

            details[pillarId] = {
                name: pillar.name,
                score: categories[pillarId],
                dimensions: pillarDims.map(dimId => ({
                    id: dimId,
                    score: dimensions[dimId] || 0,
                })),
                completeness: dimScores.length / pillarDims.length,
            };
        }
    });

    // Calculate overall score
    const overall = totalWeight > 0
        ? Math.round((totalWeightedScore / totalWeight) * 100) / 100
        : 0;

    // Calculate maturity level
    const maturityLevel = getADMAMaturityLevel(overall);

    return {
        overall,
        categories,
        details,
        maturityLevel,
        scaleMax: config.scale.max,
        completeness: totalDimensions > 0 ? completedDimensions / totalDimensions : 0,
    };
}

/**
 * Get ADMA maturity level label
 */
function getADMAMaturityLevel(score) {
    if (score >= 4.5) return { level: 5, label: 'Digital Champion', description: 'Fully integrated digital ecosystem' };
    if (score >= 3.5) return { level: 4, label: 'Digital Performer', description: 'Advanced digital capabilities' };
    if (score >= 2.5) return { level: 3, label: 'Digital Adopter', description: 'Digital initiatives underway' };
    if (score >= 1.5) return { level: 2, label: 'Digital Beginner', description: 'Initial digital awareness' };
    return { level: 1, label: 'Digital Newcomer', description: 'Limited digital presence' };
}

// ============================================
// CMMI SCORE CALCULATOR
// ============================================

/**
 * Calculate CMMI assessment scores
 * Uses staged representation: overall level = minimum level across all practice areas
 * @param {Object} data - CMMI assessment data
 * @returns {Object} { overall, categories, details }
 */
function calculateCMMIScore(data) {
    const config = FRAMEWORK_CONFIG.CMMI;
    const practiceAreas = data.practiceAreas || {};
    const categories = {};
    const details = {};

    let allPracticeAreaScores = [];

    // Calculate category scores
    Object.entries(config.categories).forEach(([catId, category]) => {
        const areaScores = category.practiceAreas.map(paId => {
            const score = practiceAreas[paId];
            return typeof score === 'number' ? score : null;
        }).filter(s => s !== null);

        if (areaScores.length > 0) {
            // For CMMI, category level is the minimum across practice areas
            const categoryScore = Math.min(...areaScores);
            categories[catId] = categoryScore;
            allPracticeAreaScores = allPracticeAreaScores.concat(areaScores);

            details[catId] = {
                name: category.name,
                score: categoryScore,
                practiceAreas: category.practiceAreas.map(paId => ({
                    id: paId,
                    score: practiceAreas[paId] || 0,
                })),
                completeness: areaScores.length / category.practiceAreas.length,
            };
        }
    });

    // CMMI staged representation: overall = minimum across ALL practice areas
    const overall = allPracticeAreaScores.length > 0
        ? Math.min(...allPracticeAreaScores)
        : 1;

    // Get maturity level description
    const maturityLevel = {
        level: overall,
        label: config.levels[overall] || config.levels[1],
        description: getCMMILevelDescription(overall),
    };

    // Calculate target gaps
    const gaps = calculateCMMIGaps(practiceAreas, overall);

    return {
        overall,
        categories,
        details,
        maturityLevel,
        gaps,
        scaleMax: config.scale.max,
        completeness: calculateCompleteness(practiceAreas, 20), // 20 practice areas in CMMI
    };
}

/**
 * Get CMMI level description
 */
function getCMMILevelDescription(level) {
    const descriptions = {
        1: 'Unpredictable process with ad hoc and reactive controls',
        2: 'Processes are planned, performed, measured, and controlled',
        3: 'Organization-wide standards provide guidance across projects',
        4: 'Quantitative objectives for quality and process performance are established',
        5: 'Focus on continuous improvement through incremental and innovative changes',
    };
    return descriptions[level] || descriptions[1];
}

/**
 * Calculate gaps to next level for each practice area
 */
function calculateCMMIGaps(practiceAreas, currentLevel) {
    const gaps = {};
    const targetLevel = Math.min(5, currentLevel + 1);

    Object.entries(practiceAreas).forEach(([paId, score]) => {
        if (score < targetLevel) {
            gaps[paId] = {
                current: score,
                target: targetLevel,
                gap: targetLevel - score,
                isBlocker: score === currentLevel, // This PA is blocking advancement
            };
        }
    });

    return gaps;
}

// ============================================
// LEAN 4.0 SCORE CALCULATOR
// ============================================

/**
 * Calculate Lean 4.0 (DBR77) assessment scores
 * @param {Object} data - Lean assessment data
 * @returns {Object} { overall, categories, details }
 */
function calculateLeanScore(data) {
    const config = FRAMEWORK_CONFIG.LEAN;
    const { processes = [], workstations = [], managementPractices = {} } = data;
    const categories = {};
    const details = {};

    // MEASURE phase: Process and workstation analysis completeness
    const measureScore = calculateMeasurePhaseScore(processes, workstations);
    categories.MEASURE = measureScore.score;
    details.MEASURE = {
        name: config.phases.MEASURE.name,
        score: measureScore.score,
        processCount: processes.length,
        workstationCount: workstations.length,
        completeness: measureScore.completeness,
    };

    // OPTIMIZE phase: Lean practices maturity
    const optimizeScore = calculateOptimizePhaseScore(processes, managementPractices);
    categories.OPTIMIZE = optimizeScore.score;
    details.OPTIMIZE = {
        name: config.phases.OPTIMIZE.name,
        score: optimizeScore.score,
        wastesIdentified: optimizeScore.wastesIdentified,
        improvementPotential: optimizeScore.improvementPotential,
    };

    // AUTOMATE phase: Automation potential and readiness
    const automateScore = calculateAutomatePhaseScore(workstations, processes);
    categories.AUTOMATE = automateScore.score;
    details.AUTOMATE = {
        name: config.phases.AUTOMATE.name,
        score: automateScore.score,
        automationCandidates: automateScore.candidates,
        aiReadiness: automateScore.aiReadiness,
    };

    // Calculate weighted overall score
    let totalWeightedScore = 0;
    let totalWeight = 0;
    Object.entries(config.phases).forEach(([phaseId, phase]) => {
        if (categories[phaseId]) {
            totalWeightedScore += categories[phaseId] * phase.weight;
            totalWeight += phase.weight;
        }
    });

    const overall = totalWeight > 0
        ? Math.round((totalWeightedScore / totalWeight) * 100) / 100
        : 0;

    // Calculate Lean maturity and automation potential
    const leanMaturity = getLeanMaturityLevel(categories.OPTIMIZE || 0);
    const automationPotential = calculateAutomationPotential(workstations);

    return {
        overall,
        categories,
        details,
        leanMaturity,
        automationPotential,
        scaleMax: config.scale.max,
        completeness: calculateLeanCompleteness(data),
    };
}

/**
 * Calculate MEASURE phase score
 */
function calculateMeasurePhaseScore(processes, workstations) {
    let score = 1;
    let completeness = 0;

    // Check process documentation
    const documentedProcesses = processes.filter(p => p.steps && p.steps.length > 0);
    const processCompleteness = processes.length > 0 ? documentedProcesses.length / processes.length : 0;

    // Check workstation documentation
    const documentedWorkstations = workstations.filter(w => w.tasks && w.tasks.length > 0);
    const workstationCompleteness = workstations.length > 0 ? documentedWorkstations.length / workstations.length : 0;

    completeness = (processCompleteness + workstationCompleteness) / 2;

    // Score based on documentation quality
    if (completeness >= 0.9) score = 5;
    else if (completeness >= 0.7) score = 4;
    else if (completeness >= 0.5) score = 3;
    else if (completeness >= 0.3) score = 2;

    return { score, completeness };
}

/**
 * Calculate OPTIMIZE phase score
 */
function calculateOptimizePhaseScore(processes, managementPractices) {
    let score = 1;
    let wastesIdentified = 0;
    let improvementPotential = 0;

    // Count identified wastes across processes
    processes.forEach(process => {
        if (process.wastes) {
            wastesIdentified += Object.values(process.wastes).filter(w => w > 0).length;
        }
    });

    // Check management practices
    const practiceCategories = ['fiveS', 'kaizen', 'standardWork', 'visualManagement', 'tpm'];
    const implementedPractices = practiceCategories.filter(
        cat => managementPractices[cat] && managementPractices[cat].implemented
    ).length;

    const practiceScore = implementedPractices / practiceCategories.length;

    // Calculate improvement potential
    improvementPotential = processes.reduce((sum, p) => {
        return sum + (p.improvementPotential || 0);
    }, 0) / Math.max(1, processes.length);

    // Combined score
    score = Math.round((practiceScore * 5 + (wastesIdentified > 0 ? 2 : 0)) / 1.4);
    score = Math.min(5, Math.max(1, score));

    return { score, wastesIdentified, improvementPotential };
}

/**
 * Calculate AUTOMATE phase score
 */
function calculateAutomatePhaseScore(workstations, processes) {
    let score = 1;
    let candidates = [];
    let aiReadiness = 0;

    // Find automation candidates
    workstations.forEach(workstation => {
        if (workstation.automationPotential >= 3) {
            candidates.push({
                id: workstation.id,
                name: workstation.name,
                potential: workstation.automationPotential,
                type: workstation.automationType || 'STANDARD',
            });
        }
        aiReadiness += workstation.aiReadiness || 0;
    });

    // Average AI readiness
    aiReadiness = workstations.length > 0 ? aiReadiness / workstations.length : 0;

    // Score based on automation analysis completeness
    const assessedWorkstations = workstations.filter(w =>
        typeof w.automationPotential === 'number'
    ).length;

    const assessmentCompleteness = workstations.length > 0
        ? assessedWorkstations / workstations.length
        : 0;

    if (assessmentCompleteness >= 0.9 && candidates.length > 0) score = 5;
    else if (assessmentCompleteness >= 0.7) score = 4;
    else if (assessmentCompleteness >= 0.5) score = 3;
    else if (assessmentCompleteness >= 0.3) score = 2;

    return { score, candidates, aiReadiness };
}

/**
 * Get Lean maturity level
 */
function getLeanMaturityLevel(optimizeScore) {
    if (optimizeScore >= 4.5) return { level: 5, label: 'Lean Excellence', description: 'Continuous improvement culture' };
    if (optimizeScore >= 3.5) return { level: 4, label: 'Lean Advanced', description: 'Systematic waste elimination' };
    if (optimizeScore >= 2.5) return { level: 3, label: 'Lean Practitioner', description: 'Lean tools applied' };
    if (optimizeScore >= 1.5) return { level: 2, label: 'Lean Aware', description: 'Initial Lean awareness' };
    return { level: 1, label: 'Traditional', description: 'No formal Lean practices' };
}

/**
 * Calculate automation potential summary
 */
function calculateAutomationPotential(workstations) {
    const total = workstations.length;
    if (total === 0) return { high: 0, medium: 0, low: 0, totalTasks: 0 };

    const high = workstations.filter(w => (w.automationPotential || 0) >= 4).length;
    const medium = workstations.filter(w => (w.automationPotential || 0) >= 2 && (w.automationPotential || 0) < 4).length;
    const low = total - high - medium;

    const totalTasks = workstations.reduce((sum, w) => sum + (w.tasks?.length || 0), 0);

    return {
        high,
        medium,
        low,
        totalTasks,
        highPercent: Math.round((high / total) * 100),
        mediumPercent: Math.round((medium / total) * 100),
        lowPercent: Math.round((low / total) * 100),
    };
}

/**
 * Calculate Lean assessment completeness
 */
function calculateLeanCompleteness(data) {
    let fields = 0;
    let completed = 0;

    // Check processes
    if (data.processes) {
        fields += 3; // At least 3 required fields
        if (data.processes.length > 0) completed++;
        if (data.processes.some(p => p.steps?.length > 0)) completed++;
        if (data.processes.some(p => p.wastes)) completed++;
    }

    // Check workstations
    if (data.workstations) {
        fields += 3;
        if (data.workstations.length > 0) completed++;
        if (data.workstations.some(w => w.tasks?.length > 0)) completed++;
        if (data.workstations.some(w => typeof w.automationPotential === 'number')) completed++;
    }

    // Check management practices
    fields += 1;
    if (Object.keys(data.managementPractices || {}).length > 0) completed++;

    return fields > 0 ? completed / fields : 0;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Calculate completeness of assessment
 */
function calculateCompleteness(data, totalFields) {
    const filledFields = Object.values(data).filter(v => v != null && v !== '').length;
    return totalFields > 0 ? filledFields / totalFields : 0;
}

// ============================================
// MAIN EXPORT
// ============================================

/**
 * Calculate scores for any framework
 * @param {string} framework - Framework ID (SIRI, ADMA, CMMI, LEAN)
 * @param {Object} data - Assessment data
 * @returns {Object} Score results
 */
export const calculateFrameworkScore = (framework, answers) => {
    switch (framework?.toUpperCase()) {
        case 'SIRI':
            return calculateSIRIScore(answers);
        case 'ADMA':
            return calculateADMAScore(answers);
        case 'CMMI':
            return calculateCMMIScore(data);
        case 'LEAN':
            return calculateLeanScore(data);
        default:
            throw new Error(`Unknown framework: ${framework}`);
    }
};










