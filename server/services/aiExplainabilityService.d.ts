export namespace AIConfidenceLevel {
    let LOW: string;
    let MEDIUM: string;
    let HIGH: string;
}
export namespace AIProjectRole {
    let ADVISOR: string;
    let MANAGER: string;
    let OPERATOR: string;
}
export function _countPopulatedLayers(context: any): number;
export function _getBlockerCount(context: any): number;
export function _extractExternalSources(context: any): any[];
export function _mapOrchestratorRoleToProjectRole(orchestratorRole: any): any;
export function computeConfidenceLevel(context: Object, options?: Object): string;
export function buildReasoningSummary(context: Object, options?: Object): string;
export function extractConstraintsApplied(context: Object, policy: Object, aiRole: string): string[];
export function identifyDataUsed(context: Object, options?: Object): Object;
export function buildAIExplanation(responseContext: Object): Object;
export function buildExplainabilityFooter(explanation: Object): string;
declare namespace _default {
    export { AIConfidenceLevel };
    export { AIProjectRole };
    export { computeConfidenceLevel };
    export { buildReasoningSummary };
    export { extractConstraintsApplied };
    export { identifyDataUsed };
    export { buildAIExplanation };
    export { buildExplainabilityFooter };
    export { _countPopulatedLayers };
    export { _getBlockerCount };
    export { _extractExternalSources };
    export { _mapOrchestratorRoleToProjectRole };
}
export default _default;
//# sourceMappingURL=aiExplainabilityService.d.ts.map