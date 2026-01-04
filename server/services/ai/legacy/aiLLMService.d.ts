export function createAILLMService({ deps, AccessPolicyService }: {
    deps: any;
    AccessPolicyService: any;
}): {
    callLLM: (prompt: any, systemInstruction?: string, history?: any[], providerId?: null, userId?: null, action?: string, images?: any[]) => Promise<string>;
    streamLLM: (prompt: any, systemInstruction?: string, history?: any[], providerId?: null, userId?: null, action?: string, images?: any[]) => AsyncGenerator<any, void, unknown>;
    testProviderConnection: (config: any) => Promise<{
        success: boolean;
        result: string;
        message?: undefined;
    } | {
        success: boolean;
        message: any;
        result?: undefined;
    }>;
};
//# sourceMappingURL=aiLLMService.d.ts.map