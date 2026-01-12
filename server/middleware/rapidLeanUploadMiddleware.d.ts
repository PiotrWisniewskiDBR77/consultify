/**
 * Create multer instance for RapidLean photo uploads
 * @param {string} organizationId - Organization ID
 * @param {string} assessmentId - Assessment ID (optional, for organizing files)
 * @returns {Object} Multer instance
 */
export function createRapidLeanUpload(organizationId: string, assessmentId?: string): Object;
/**
 * Middleware factory for RapidLean photo uploads
 */
export function rapidLeanPhotoUpload(req: any, res: any, next: any): any;
export function _setDependencies(deps: any): void;
//# sourceMappingURL=rapidLeanUploadMiddleware.d.ts.map