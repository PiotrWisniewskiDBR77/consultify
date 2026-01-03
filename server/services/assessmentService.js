import { createAssessmentAnalysis } from './assessment/assessmentAnalysis.js';
import { createAssessmentStorage } from './assessment/assessmentStorage.js';
import { createAssessmentWorkflow } from './assessment/assessmentWorkflow.js';

// Dependency injection for testing
let deps = {
    db: null,
    uuidv4: null
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps.db) {
        const dbModule = await import('../database.js');
        deps.db = dbModule.default || dbModule;
    }

    if (!deps.uuidv4) {
        const uuidModule = await import('uuid');
        deps.uuidv4 = uuidModule.v4;
    }
}

const assessmentStorage = createAssessmentStorage({ deps, initDeps });
const assessmentAnalysis = createAssessmentAnalysis();
const assessmentWorkflow = createAssessmentWorkflow({
    deps,
    initDeps,
    getAssessment: (...args) => assessmentStorage.getAssessment(...args),
    getAssessmentStatus: (...args) => assessmentStorage.getAssessmentStatus(...args)
});

const AssessmentService = {
    // For testing: allow overriding dependencies
    setDependencies: (newDeps) => {
        Object.assign(deps, newDeps);
    },
    getAssessment: assessmentStorage.getAssessment,
    saveAssessment: assessmentStorage.saveAssessment,
    generateGapSummary: assessmentAnalysis.generateGapSummary,
    getAssessmentStatus: assessmentStorage.getAssessmentStatus,
    canEditAssessment: assessmentWorkflow.canEditAssessment,
    finalizeAssessment: assessmentWorkflow.finalizeAssessment
};

export default AssessmentService;
