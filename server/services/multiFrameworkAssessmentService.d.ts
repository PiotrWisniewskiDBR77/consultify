declare namespace _default {
    export { createAssessment };
    export { getAssessment };
    export { updateAssessment };
    export { deleteAssessment };
    export { duplicateAssessment };
    export { listAssessments };
    export { recalculateScore };
    export { mapToUnifiedGaps };
    export { VALID_FRAMEWORKS };
    export { VALID_STATUSES };
    export { setDependencies };
}
export default _default;
/**
 * Create a new assessment
 */
export function createAssessment(projectId: any, framework: any, data: any, userId: any, options?: {}): Promise<any>;
/**
 * Get assessment by ID
 */
export function getAssessment(id: any): Promise<any>;
/**
 * Update assessment
 */
export function updateAssessment(id: any, data: any, userId: any): Promise<any>;
/**
 * Delete (archive) assessment
 */
export function deleteAssessment(id: any, userId: any): Promise<boolean>;
/**
 * Duplicate assessment
 */
export function duplicateAssessment(id: any, newName: any, userId: any): Promise<any>;
/**
 * List assessments for a project
 */
export function listAssessments(projectId: any, options?: {}): Promise<any>;
/**
 * Recalculate overall score for assessment
 */
export function recalculateScore(id: any, userId: any): Promise<any>;
/**
 * Map assessment to unified gap format for initiative generation
 */
export function mapToUnifiedGaps(framework: any, data: any, scoreResult: any): any[];
export const VALID_FRAMEWORKS: string[];
export const VALID_STATUSES: string[];
/**
 * Set dependencies for testing
 */
export function setDependencies(newDeps: any): void;
//# sourceMappingURL=multiFrameworkAssessmentService.d.ts.map