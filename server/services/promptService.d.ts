export interface UserContext {
    firstName?: string;
    role?: string;
}
export interface CompanyContext {
    name?: string;
    industry?: string;
    size?: string;
}
export interface ScreenContext {
    title?: string;
    description?: string;
    data?: unknown;
}
export interface StrategyContext {
    title: string;
    description: string;
}
export interface BuildSystemPromptContext {
    user?: UserContext;
    company?: CompanyContext;
    screen?: ScreenContext;
    strategies?: StrategyContext[];
    baseInstruction?: string;
    knowledge?: string;
}
export interface PromptServiceInterface {
    buildSystemPrompt: (context: BuildSystemPromptContext) => string;
}
declare const PromptService: PromptServiceInterface;
export default PromptService;
//# sourceMappingURL=promptService.d.ts.map