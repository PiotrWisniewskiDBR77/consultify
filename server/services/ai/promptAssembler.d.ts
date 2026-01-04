declare namespace _default {
    export { PromptAssembler };
    export { ROLE_INSTRUCTIONS };
    export { FALLBACK_ROLES };
}
export default _default;
export class PromptAssembler {
    build(params: any): Promise<{
        systemPrompt: any;
        messages: any[];
        metadata: {
            promptKey: any;
            role: any;
            hasVisualContext: boolean;
        };
    }>;
    /**
     * Infer role from capability if not explicitly set
     */
    inferRoleFromCapability(capability: any): any;
    mapCapabilityToKey(capability: any): any;
    getSystemPrompt(key: any, options?: {}): Promise<any>;
    /**
     * Log prompt version usage for A/B testing analytics
     */
    logPromptUsage(key: any, version: any, experimentGroup: any): void;
    /**
     * Get prompt performance metrics for A/B analysis
     */
    getPromptMetrics(key: any): Promise<any>;
    /**
     * Inject standard context data
     */
    injectContext(promptContent: any, context: any, config: any): any;
    /**
     * Inject Visual/Screen Context - AI Eyes Feature
     */
    injectScreenState(promptContent: any, screenData: any): string;
}
export namespace ROLE_INSTRUCTIONS {
    let ADVISOR: string;
    let ANALYST: string;
    let STRATEGIST: string;
    let MAX_REASONER: string;
}
export namespace FALLBACK_ROLES {
    let ANALYST_1: string;
    export { ANALYST_1 as ANALYST };
    export let PARTNER: string;
    export let GATEKEEPER: string;
    export let CONSULTANT: string;
    let STRATEGIST_1: string;
    export { STRATEGIST_1 as STRATEGIST };
    export let FINANCE: string;
    export let MENTOR: string;
    export let IMPLEMENTER: string;
    export let SME: string;
}
//# sourceMappingURL=promptAssembler.d.ts.map