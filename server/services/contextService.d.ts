export default ContextService;
declare namespace ContextService {
    export { CONTEXT_LEVELS };
    export { REQUIRED_FIELDS };
    export { FINALIZATION_THRESHOLD };
    export function getContext(projectId: string): Promise<Object>;
    export function getFullContext(projectId: string, organizationId: string): Promise<Object>;
    export function getOrganizationProfile(organizationId: string): Promise<Object>;
    export function saveContext(projectId: string, contextData: Object): Promise<any>;
    export function calculateReadiness(context: Object): Object;
    export function checkFinalizationReadiness(projectId: string, organizationId: string): Promise<Object>;
    export function _isFieldFilled(value: any): boolean;
    export function _generateRecommendations(gaps: any, currentScore: any): {
        priority: string;
        message: string;
        fields: any;
    }[];
    export function getContextSummaryForAI(projectId: string, organizationId: string): Promise<string>;
}
declare namespace CONTEXT_LEVELS {
    namespace INSUFFICIENT {
        let threshold: number;
        let maxThreshold: number;
        let canFinalize: boolean;
        let canGenerateReport: boolean;
        let label: string;
        let description: string;
    }
    namespace MINIMAL {
        let threshold_1: number;
        export { threshold_1 as threshold };
        let maxThreshold_1: number;
        export { maxThreshold_1 as maxThreshold };
        let canFinalize_1: boolean;
        export { canFinalize_1 as canFinalize };
        let canGenerateReport_1: boolean;
        export { canGenerateReport_1 as canGenerateReport };
        let label_1: string;
        export { label_1 as label };
        let description_1: string;
        export { description_1 as description };
    }
    namespace STANDARD {
        let threshold_2: number;
        export { threshold_2 as threshold };
        let maxThreshold_2: number;
        export { maxThreshold_2 as maxThreshold };
        let canFinalize_2: boolean;
        export { canFinalize_2 as canFinalize };
        let canGenerateReport_2: boolean;
        export { canGenerateReport_2 as canGenerateReport };
        let label_2: string;
        export { label_2 as label };
        let description_2: string;
        export { description_2 as description };
    }
    namespace COMPLETE {
        let threshold_3: number;
        export { threshold_3 as threshold };
        let maxThreshold_3: number;
        export { maxThreshold_3 as maxThreshold };
        let canFinalize_3: boolean;
        export { canFinalize_3 as canFinalize };
        let canGenerateReport_3: boolean;
        export { canGenerateReport_3 as canGenerateReport };
        let label_3: string;
        export { label_3 as label };
        let description_3: string;
        export { description_3 as description };
    }
}
declare const REQUIRED_FIELDS: {
    key: string;
    weight: number;
    label: string;
    category: string;
    required: boolean;
}[];
declare const FINALIZATION_THRESHOLD: number;
//# sourceMappingURL=contextService.d.ts.map