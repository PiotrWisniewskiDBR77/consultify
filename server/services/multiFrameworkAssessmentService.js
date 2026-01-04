/**
 * Multi-Framework Assessment Service
 * 
 * Centralized service for managing assessments across all frameworks.
 * Provides CRUD operations, score calculation, gap analysis, and initiative mapping.
 */

// Dependency injection for testing
let deps = {
    db: null,
    uuidv4: null,
    frameworkScoreCalculators: null,
    multiFrameworkAuditService: null
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps.db) {
        const dbModule = await import('../src/database/Database.ts');
    const { getDatabase } = dbModule;
    deps.db = getDatabase();
    }

    if (!deps.uuidv4) {
        const uuidModule = await import('uuid');
        deps.uuidv4 = uuidModule.v4;
    }

    if (!deps.frameworkScoreCalculators) {
        const calcModule = await import('./frameworkScoreCalculators.js');
        deps.frameworkScoreCalculators = calcModule;
    }

    if (!deps.multiFrameworkAuditService) {
        const auditModule = await import('./multiFrameworkAuditService.js');
        deps.multiFrameworkAuditService = auditModule.default || auditModule;
    }
}

/**
 * Set dependencies for testing
 */
function setDependencies(newDeps) {
    deps = { ...deps, ...newDeps };
}

// ============================================
// CONSTANTS
// ============================================

const VALID_FRAMEWORKS = ['SIRI', 'ADMA', 'CMMI', 'LEAN'];
const VALID_STATUSES = ['DRAFT', 'IN_REVIEW', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'ARCHIVED'];

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * Create a new assessment
 */
async function createAssessment(projectId, framework, data, userId, options = {}) {
    const { name, organizationId, importSource } = options;

    if (!VALID_FRAMEWORKS.includes(framework)) {
        throw new Error(`Invalid framework: ${framework}`);
    }

    await initDeps();
    const id = deps.uuidv4();

    // Calculate initial scores
    let overallScore = null;
    let categoryScores = {};
    if (data && Object.keys(data).length > 0) {
        try {
            const scoreResult = deps.frameworkScoreCalculators.calculateFrameworkScore(framework, data);
            overallScore = scoreResult.overall;
            categoryScores = scoreResult.categories;
        } catch (e) {
            console.warn('[MFAssessmentService] Score calculation warning:', e.message);
        }
    }

    const result = await deps.db.query(`
        INSERT INTO multi_framework_assessments (
            id, project_id, organization_id, framework, name, data,
            overall_score, category_scores, import_source,
            created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING *
    `, [
        id,
        projectId,
        organizationId,
        framework,
        name || `${framework} Assessment - ${new Date().toLocaleDateString()}`,
        JSON.stringify(data || {}),
        overallScore,
        JSON.stringify(categoryScores),
        importSource ? JSON.stringify(importSource) : null,
        userId,
    ]);

    // Audit log
    await deps.multiFrameworkAuditService.logCreate(id, framework, userId, data);

    return result.rows[0];
}

/**
 * Get assessment by ID
 */
async function getAssessment(id) {
    await initDeps();
    const result = await deps.db.query(`
        SELECT 
            mfa.*,
            u.first_name || ' ' || u.last_name AS created_by_name,
            u.email AS created_by_email
        FROM multi_framework_assessments mfa
        LEFT JOIN users u ON mfa.created_by = u.id
        WHERE mfa.id = $1
    `, [id]);

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}

/**
 * Update assessment
 */
async function updateAssessment(id, data, userId) {
    // Get current state for audit
    const current = await getAssessment(id);
    if (!current) {
        throw new Error('Assessment not found');
    }

    if (['APPROVED', 'ARCHIVED'].includes(current.status)) {
        throw new Error('Cannot update approved or archived assessment');
    }

    // Recalculate scores
    let overallScore = current.overall_score;
    let categoryScores = current.category_scores;
    if (data) {
        try {
            const scoreResult = deps.frameworkScoreCalculators.calculateFrameworkScore(current.framework, data);
            overallScore = scoreResult.overall;
            categoryScores = scoreResult.categories;
        } catch (e) {
            console.warn('[MFAssessmentService] Score calculation warning:', e.message);
        }
    }

    // Save version history
    await deps.db.query(`
        INSERT INTO multi_framework_assessment_versions (
            assessment_id, version, data, overall_score, category_scores,
            change_summary, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [
        id,
        current.version,
        JSON.stringify(current.data),
        current.overall_score,
        JSON.stringify(current.category_scores),
        'Auto-saved before update',
        userId,
    ]);

    // Update assessment
    const result = await deps.db.query(`
        UPDATE multi_framework_assessments
        SET 
            data = $1,
            overall_score = $2,
            category_scores = $3,
            version = version + 1,
            updated_at = NOW(),
            updated_by = $4
        WHERE id = $5
        RETURNING *
    `, [
        JSON.stringify(data),
        overallScore,
        JSON.stringify(categoryScores),
        userId,
        id,
    ]);

    // Audit log
    await deps.multiFrameworkAuditService.logUpdate(id, current.framework, userId, current.data, data);

    return result.rows[0];
}

/**
 * Delete (archive) assessment
 */
async function deleteAssessment(id, userId) {
    const current = await getAssessment(id);
    if (!current) {
        throw new Error('Assessment not found');
    }

    await deps.db.query(
        'UPDATE multi_framework_assessments SET status = $1, updated_at = NOW() WHERE id = $2',
        ['ARCHIVED', id]
    );

    // Audit log
    await deps.multiFrameworkAuditService.logDelete(id, current.framework, userId, current.data);

    return true;
}

/**
 * Duplicate assessment
 */
async function duplicateAssessment(id, newName, userId) {
    const source = await getAssessment(id);
    if (!source) {
        throw new Error('Source assessment not found');
    }

    return createAssessment(
        source.project_id,
        source.framework,
        source.data,
        userId,
        {
            name: newName || `${source.name} (Copy)`,
            organizationId: source.organization_id,
        }
    );
}

/**
 * List assessments for a project
 */
async function listAssessments(projectId, options = {}) {
    const { framework, status, limit = 100, offset = 0 } = options;

    let query = `
        SELECT 
            mfa.*,
            u.first_name || ' ' || u.last_name AS created_by_name,
            (SELECT COUNT(*) FROM multi_framework_assessment_reviewers r WHERE r.assessment_id = mfa.id) AS reviewer_count
        FROM multi_framework_assessments mfa
        LEFT JOIN users u ON mfa.created_by = u.id
        WHERE mfa.project_id = $1 AND mfa.status != 'ARCHIVED'
    `;
    const params = [projectId];
    let paramIndex = 2;

    if (framework && VALID_FRAMEWORKS.includes(framework)) {
        query += ` AND mfa.framework = $${paramIndex}`;
        params.push(framework);
        paramIndex++;
    }

    if (status && VALID_STATUSES.includes(status)) {
        query += ` AND mfa.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
    }

    query += ` ORDER BY mfa.updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await deps.db.query(query, params);
    return result.rows;
}

// ============================================
// SCORE CALCULATION
// ============================================

/**
 * Recalculate overall score for assessment
 */
async function recalculateScore(id, userId) {
    const assessment = await getAssessment(id);
    if (!assessment) {
        throw new Error('Assessment not found');
    }

    const scoreResult = deps.frameworkScoreCalculators.calculateFrameworkScore(assessment.framework, assessment.data);

    await deps.db.query(`
        UPDATE multi_framework_assessments
        SET 
            overall_score = $1,
            category_scores = $2,
            updated_at = NOW()
        WHERE id = $3
    `, [
        scoreResult.overall,
        JSON.stringify(scoreResult.categories),
        id,
    ]);

    // Audit log
    await deps.multiFrameworkAuditService.logAction({
        assessmentId: id,
        framework: assessment.framework,
        action: 'SCORE_RECALCULATE',
        actorId: userId,
        newData: { overall: scoreResult.overall, categories: scoreResult.categories },
    });

    return scoreResult;
}

// ============================================
// GAP ANALYSIS
// ============================================

/**
 * Map assessment to unified gap format for initiative generation
 */
function mapToUnifiedGaps(framework, data, scoreResult) {
    const gaps = [];
    const targetLevel = getTargetLevel(framework, scoreResult.overall);

    switch (framework) {
        case 'SIRI':
            return mapSIRIGaps(data, scoreResult, targetLevel);
        case 'ADMA':
            return mapADMAGaps(data, scoreResult, targetLevel);
        case 'CMMI':
            return mapCMMIGaps(data, scoreResult, targetLevel);
        case 'LEAN':
            return mapLeanGaps(data, scoreResult);
        default:
            return gaps;
    }
}

/**
 * Determine target level based on current score
 */
function getTargetLevel(framework, currentScore) {
    // Default: aim for next integer level, max = framework max
    const maxLevels = { SIRI: 5, ADMA: 5, CMMI: 5, LEAN: 5 };
    const max = maxLevels[framework] || 5;
    return Math.min(max, Math.ceil(currentScore) + 1);
}

/**
 * Map SIRI assessment to gaps
 */
function mapSIRIGaps(data, scoreResult, targetLevel) {
    const gaps = [];
    const dimensions = data.dimensions || {};

    Object.entries(dimensions).forEach(([dimId, score]) => {
        if (score < targetLevel) {
            gaps.push({
                framework: 'SIRI',
                dimensionId: dimId,
                dimensionName: getSIRIDimensionName(dimId),
                currentScore: score,
                targetScore: targetLevel,
                gap: targetLevel - score,
                priority: targetLevel - score > 2 ? 'HIGH' : targetLevel - score > 1 ? 'MEDIUM' : 'LOW',
                buildingBlock: getSIRIBuildingBlock(dimId),
            });
        }
    });

    return gaps.sort((a, b) => b.gap - a.gap);
}

/**
 * Map ADMA assessment to gaps
 */
function mapADMAGaps(data, scoreResult, targetLevel) {
    const gaps = [];
    const dimensions = data.dimensions || {};

    Object.entries(dimensions).forEach(([dimId, score]) => {
        if (score < targetLevel) {
            gaps.push({
                framework: 'ADMA',
                dimensionId: dimId,
                dimensionName: getADMADimensionName(dimId),
                currentScore: score,
                targetScore: targetLevel,
                gap: targetLevel - score,
                priority: targetLevel - score > 2 ? 'HIGH' : targetLevel - score > 1 ? 'MEDIUM' : 'LOW',
                pillar: getADMAPillar(dimId),
            });
        }
    });

    return gaps.sort((a, b) => b.gap - a.gap);
}

/**
 * Map CMMI assessment to gaps
 */
function mapCMMIGaps(data, scoreResult, targetLevel) {
    const gaps = [];
    const practiceAreas = data.practiceAreas || {};
    const currentLevel = Math.min(...Object.values(practiceAreas).filter(v => v > 0)) || 1;

    Object.entries(practiceAreas).forEach(([paId, level]) => {
        if (level < targetLevel) {
            const isBlocker = level <= currentLevel;
            gaps.push({
                framework: 'CMMI',
                practiceAreaId: paId,
                practiceAreaName: getCMMIPracticeAreaName(paId),
                currentLevel: level,
                targetLevel: targetLevel,
                gap: targetLevel - level,
                priority: isBlocker ? 'CRITICAL' : level < currentLevel + 1 ? 'HIGH' : 'MEDIUM',
                isBlocker,
                category: getCMMICategory(paId),
            });
        }
    });

    return gaps.sort((a, b) => {
        if (a.isBlocker && !b.isBlocker) return -1;
        if (!a.isBlocker && b.isBlocker) return 1;
        return b.gap - a.gap;
    });
}

/**
 * Map Lean 4.0 assessment to gaps
 */
function mapLeanGaps(data, scoreResult) {
    const gaps = [];
    const { processes = [], workstations = [] } = data;

    // Process-level gaps
    processes.forEach(process => {
        if (process.wastes) {
            Object.entries(process.wastes).forEach(([wasteType, severity]) => {
                if (severity > 2) {
                    gaps.push({
                        framework: 'LEAN',
                        type: 'WASTE',
                        processId: process.id,
                        processName: process.name,
                        wasteType,
                        severity,
                        priority: severity >= 4 ? 'HIGH' : severity >= 3 ? 'MEDIUM' : 'LOW',
                        phase: 'OPTIMIZE',
                    });
                }
            });
        }
    });

    // Workstation-level automation opportunities
    workstations.forEach(workstation => {
        if (workstation.automationPotential >= 3) {
            gaps.push({
                framework: 'LEAN',
                type: 'AUTOMATION',
                workstationId: workstation.id,
                workstationName: workstation.name,
                automationPotential: workstation.automationPotential,
                automationType: workstation.automationType || 'STANDARD',
                priority: workstation.automationPotential >= 4 ? 'HIGH' : 'MEDIUM',
                phase: 'AUTOMATE',
            });
        }
    });

    return gaps.sort((a, b) => {
        const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
}

// ============================================
// HELPER FUNCTIONS (Dimension Names)
// ============================================

function getSIRIDimensionName(dimId) {
    const names = {
        operations: 'Operations',
        supply_chain: 'Supply Chain',
        product_lifecycle: 'Product Lifecycle',
        automation: 'Automation',
        connectivity: 'Connectivity',
        intelligence: 'Intelligence',
        talent_readiness: 'Talent Readiness',
        structure_management: 'Structure & Management',
    };
    return names[dimId] || dimId;
}

function getSIRIBuildingBlock(dimId) {
    const mapping = {
        operations: 'PROCESS',
        supply_chain: 'PROCESS',
        product_lifecycle: 'PROCESS',
        automation: 'TECHNOLOGY',
        connectivity: 'TECHNOLOGY',
        intelligence: 'TECHNOLOGY',
        talent_readiness: 'ORGANIZATION',
        structure_management: 'ORGANIZATION',
    };
    return mapping[dimId] || 'PROCESS';
}

function getADMADimensionName(dimId) {
    const names = {
        leadership_strategy: 'Leadership & Strategy',
        investment_innovation: 'Investment & Innovation',
        digital_culture: 'Digital Culture',
        skills_talent: 'Skills & Talent',
        connected_products: 'Connected Products',
        digital_services: 'Digital Services',
        product_lifecycle: 'Product Lifecycle Management',
        digital_manufacturing: 'Digital Manufacturing',
        quality_4_0: 'Quality 4.0',
        flexible_production: 'Flexible Production',
        predictive_maintenance: 'Predictive Maintenance',
        e2e_visibility: 'End-to-End Visibility',
        demand_planning: 'Demand Planning',
        smart_logistics: 'Smart Logistics',
        data_governance: 'Data Governance',
        analytics_ai: 'Analytics & AI',
        data_monetization: 'Data Monetization',
    };
    return names[dimId] || dimId;
}

function getADMAPillar(dimId) {
    const mapping = {
        leadership_strategy: 'strategy',
        investment_innovation: 'strategy',
        digital_culture: 'strategy',
        skills_talent: 'strategy',
        connected_products: 'smart_products',
        digital_services: 'smart_products',
        product_lifecycle: 'smart_products',
        digital_manufacturing: 'smart_operations',
        quality_4_0: 'smart_operations',
        flexible_production: 'smart_operations',
        predictive_maintenance: 'smart_operations',
        e2e_visibility: 'smart_supply',
        demand_planning: 'smart_supply',
        smart_logistics: 'smart_supply',
        data_governance: 'data_driven',
        analytics_ai: 'data_driven',
        data_monetization: 'data_driven',
    };
    return mapping[dimId] || 'strategy';
}

function getCMMIPracticeAreaName(paId) {
    const names = {
        EST: 'Estimating',
        RDM: 'Requirements Development & Mgmt',
        TS: 'Technical Solution',
        PI: 'Product Integration',
        PR: 'Peer Reviews',
        VV: 'Verification & Validation',
        PLAN: 'Planning',
        MC: 'Monitor & Control',
        MPM: 'Managing Performance & Measurement',
        RSK: 'Risk & Opportunity Management',
        SAM: 'Supplier Agreement Management',
        CAR: 'Causal Analysis & Resolution',
        CM: 'Configuration Management',
        DAR: 'Decision Analysis & Resolution',
        GOV: 'Governance',
        II: 'Implementation Infrastructure',
        OT: 'Organizational Training',
        PAD: 'Process Asset Development',
        PCM: 'Process Management',
        PPQA: 'Process Quality Assurance',
    };
    return names[paId] || paId;
}

function getCMMICategory(paId) {
    const mapping = {
        EST: 'DOING', RDM: 'DOING', TS: 'DOING', PI: 'DOING', PR: 'DOING', VV: 'DOING',
        PLAN: 'MANAGING', MC: 'MANAGING', MPM: 'MANAGING', RSK: 'MANAGING', SAM: 'MANAGING',
        CAR: 'ENABLING', CM: 'ENABLING', DAR: 'ENABLING', GOV: 'ENABLING', II: 'ENABLING',
        OT: 'ENABLING', PAD: 'ENABLING', PCM: 'ENABLING', PPQA: 'ENABLING',
    };
    return mapping[paId] || 'DOING';
}

// ============================================
// EXPORTS
// ============================================

export default {
    // CRUD
    createAssessment,
    getAssessment,
    updateAssessment,
    deleteAssessment,
    duplicateAssessment,
    listAssessments,

    // Scoring
    recalculateScore,

    // Gap Analysis
    mapToUnifiedGaps,

    // Constants
    VALID_FRAMEWORKS,
    VALID_STATUSES,

    // Testing
    setDependencies
};

export {
    createAssessment,
    getAssessment,
    updateAssessment,
    deleteAssessment,
    duplicateAssessment,
    listAssessments,
    recalculateScore,
    mapToUnifiedGaps,
    VALID_FRAMEWORKS,
    VALID_STATUSES,
    setDependencies
};











