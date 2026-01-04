declare namespace _default {
    export { enforceTokenQuota };
    export { enforceStorageQuota };
    export { recordTokenUsageAfterResponse };
    export { recordStorageAfterUpload };
}
export default _default;
/**
 * Middleware to enforce token quota on AI endpoints
 */
declare function enforceTokenQuota(req: any, res: any, next: any): Promise<any>;
/**
 * Middleware to enforce storage quota on upload endpoints
 */
declare function enforceStorageQuota(req: any, res: any, next: any): Promise<any>;
/**
 * Record token usage after AI response
 * Call this AFTER the AI response is sent
 */
declare function recordTokenUsageAfterResponse(req: any, res: any, tokens: any, action: any): Promise<void>;
/**
 * Record storage usage after file upload
 */
declare function recordStorageAfterUpload(req: any, bytes: any, action?: string): Promise<void>;
//# sourceMappingURL=quotaMiddleware.d.ts.map