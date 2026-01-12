declare namespace _default {
    export { validateCreateAnalysis };
    export { validateUpdateAnalysis };
    export { validateAnalysisId };
    export { validateListQuery };
    export { validateBulkScores };
    export { validateSingleScore };
    export { validateCreateComparison };
    export { validateQuickCompare };
    export { validateExportRequest };
    export { validateCreateVersion };
    export { validateVersionId };
    export { validateAddEvidence };
    export { handleValidationErrors };
}
export default _default;
/**
 * Validate create analysis request
 */
declare const validateCreateAnalysis: (import("express-validator").ValidationChain | ((req: any, res: any, next: any) => any))[];
/**
 * Validate update analysis request
 */
declare const validateUpdateAnalysis: (import("express-validator").ValidationChain | ((req: any, res: any, next: any) => any))[];
/**
 * Validate analysis ID parameter
 */
declare const validateAnalysisId: (import("express-validator").ValidationChain | ((req: any, res: any, next: any) => any))[];
/**
 * Validate list analyses query
 */
declare const validateListQuery: (import("express-validator").ValidationChain | ((req: any, res: any, next: any) => any))[];
/**
 * Validate bulk scores update
 */
declare const validateBulkScores: (import("express-validator").ValidationChain | ((req: any, res: any, next: any) => any))[];
/**
 * Validate single score update
 */
declare const validateSingleScore: (import("express-validator").ValidationChain | ((req: any, res: any, next: any) => any))[];
/**
 * Validate create comparison request
 */
declare const validateCreateComparison: (import("express-validator").ValidationChain | ((req: any, res: any, next: any) => any))[];
/**
 * Validate quick compare request
 */
declare const validateQuickCompare: (import("express-validator").ValidationChain | ((req: any, res: any, next: any) => any))[];
/**
 * Validate export request
 */
declare const validateExportRequest: (import("express-validator").ValidationChain | ((req: any, res: any, next: any) => any))[];
/**
 * Validate create version request
 */
declare const validateCreateVersion: (import("express-validator").ValidationChain | ((req: any, res: any, next: any) => any))[];
/**
 * Validate version ID parameter
 */
declare const validateVersionId: (import("express-validator").ValidationChain | ((req: any, res: any, next: any) => any))[];
/**
 * Validate add evidence request
 */
declare const validateAddEvidence: (import("express-validator").ValidationChain | ((req: any, res: any, next: any) => any))[];
/**
 * Handle validation errors - returns 400 with detailed error messages
 */
declare function handleValidationErrors(req: any, res: any, next: any): any;
//# sourceMappingURL=economicsValidation.d.ts.map