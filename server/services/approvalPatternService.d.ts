export default ApprovalPatternService;
declare namespace ApprovalPatternService {
    function setDependencies(newDeps: any): void;
    function generateSignature(actionType: string, payload: object): string;
    function _normalizePayload(payload: any): {};
    function _extractPayloadTypes(payload: any): {};
    function findMatchingPattern(userId: string, actionType: string, payload: object): Promise<object | null>;
    function calculateConfidence(pattern: object, newPayload: object): number;
    function _calculateSimilarity(template1: any, template2: any): number;
    function _calculateRecencyFactor(lastDecisionAt: any): 0.7 | 1 | 0.8 | 0.95 | 0.85;
    function canAutoDecide(userId: string, actionType: string, payload: object, riskLevel?: string): Promise<{
        canAutoDecide: boolean;
        decision?: string;
        confidence?: number;
        pattern?: object;
    }>;
    function recordDecision(userId: string, organizationId: string, actionType: string, payload: object, decision: string, riskLevel?: string, enableAutoApply?: boolean): Promise<object>;
    function getUserPatterns(userId: string, actionType?: string): Promise<any[]>;
    function setAutoApply(patternId: string, enabled: boolean, userId: string): Promise<{
        success: boolean;
    }>;
    function deletePattern(patternId: string, userId: string): Promise<{
        success: boolean;
    }>;
    function getPatternStats(userId: string): Promise<object>;
    function cleanupOldPatterns(daysOld?: number): Promise<{
        deleted: number;
    }>;
}
//# sourceMappingURL=approvalPatternService.d.ts.map