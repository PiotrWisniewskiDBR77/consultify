export default PlaybookResolver;
declare namespace PlaybookResolver {
    export { MAX_CONCURRENT_PLAYBOOKS };
    export { PLAYBOOK_STATES };
    export function getNextBestPlaybooks(context: Object, limit?: number): Promise<any[]>;
    export function shouldShowPlaybook(userId: string, organizationId: string, playbookKey: string): Promise<boolean>;
    export function resolveConflicts(playbooks: any[], context: Object): any[];
    export function resolveRecommended(playbooks: any[], policySnapshot: Object, route?: string): string | null;
    export function getHelpHintForFeature(featureKey: string, context: Object): Promise<Object | null>;
    export function _getBlockReason(featureKey: string, context: Object): string;
    export function getRecommendedPlaybooks(context: Object): Promise<any[]>;
    export function _getRecommendationReason(playbook: Object, context: Object): string;
}
/**
 * Maximum number of playbooks to show at once
 */
declare const MAX_CONCURRENT_PLAYBOOKS: 3;
declare namespace PLAYBOOK_STATES {
    let AVAILABLE: string;
    let DONE: string;
    let DISMISSED: string;
}
//# sourceMappingURL=playbookResolver.d.ts.map