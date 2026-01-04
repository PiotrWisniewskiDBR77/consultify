export default variableResolver;
export class VariableResolver {
    variableCache: Map<any, any>;
    customFunctions: {};
    /**
     * Resolve all variables in a template string
     * @param {string} template - Template with {{variable}} placeholders
     * @param {object} context - Context object with data
     * @param {object} options - Resolution options
     * @returns {string} Template with resolved variables
     */
    resolveTemplate(template: string, context?: object, options?: object): string;
    /**
     * Resolve a single variable
     */
    resolveVariable(varCode: any, context?: {}, options?: {}): Promise<any>;
    /**
     * Get variable definition from DB or defaults
     */
    getVariableDefinition(varCode: any): Promise<any>;
    /**
     * Get variable definition from database
     */
    getVariableFromDB(code: any): Promise<any>;
    /**
     * Get nested value from object using dot notation
     */
    getNestedValue(obj: any, path: any): any;
    /**
     * Resolve i18n translation key
     */
    resolveI18n(key: any, language?: string): Promise<string>;
    /**
     * Register a custom resolver function
     */
    registerFunction(name: any, fn: any): void;
    /**
     * Get list of all available variables
     */
    getAvailableVariables(): Promise<{
        code: any;
        source: any;
        description: any;
        default: any;
    }[]>;
    /**
     * Get all variables from database
     */
    getAllVariablesFromDB(): Promise<any>;
    /**
     * Get human-readable description for a variable
     */
    getVariableDescription(code: any): any;
    /**
     * Validate that all required variables can be resolved
     */
    validateVariables(template: any, context: any): Promise<{
        valid: boolean;
        issues: {
            variable: string;
            issue: string;
            default: any;
        }[];
    }>;
    /**
     * Escape regex special characters
     */
    escapeRegex(string: any): any;
}
export const variableResolver: VariableResolver;
export namespace RUNTIME_FUNCTIONS {
    function detectLanguage(text: any, context: any): any;
    function getCurrentDateTime(): string;
    function getCurrentDate(): string;
    function getTimeOfDayContext(): "morning" | "afternoon" | "evening";
    function formatAssessmentSummary(context: any): string;
    function formatInitiativeList(context: any): any;
    function summarizeConversation(context: any): string;
}
export const DEFAULT_VARIABLES: {
    'user.language': {
        source: string;
        path: string;
        default: string;
    };
    'user.name': {
        source: string;
        path: string;
        default: string;
    };
    'user.fullName': {
        source: string;
        path: string;
        default: string;
    };
    'user.role': {
        source: string;
        path: string;
        default: string;
    };
    'user.detected_language': {
        source: string;
        resolver: string;
    };
    'organization.name': {
        source: string;
        path: string;
        default: string;
    };
    'organization.industry': {
        source: string;
        path: string;
        default: string;
    };
    'organization.size': {
        source: string;
        path: string;
        default: string;
    };
    'context.project.name': {
        source: string;
        path: string;
        default: string;
    };
    'context.project.phase': {
        source: string;
        path: string;
        default: string;
    };
    'context.project.assessmentSummary': {
        source: string;
        resolver: string;
    };
    'context.project.initiativeCount': {
        source: string;
        path: string;
        default: string;
    };
    'context.project.initiativeList': {
        source: string;
        resolver: string;
    };
    'context.project.timelineStatus': {
        source: string;
        path: string;
        default: string;
    };
    'context.project.constraints': {
        source: string;
        path: string;
        default: string;
    };
    'context.screen.title': {
        source: string;
        path: string;
        default: string;
    };
    'context.screen.description': {
        source: string;
        path: string;
        default: string;
    };
    'context.screen.data': {
        source: string;
        path: string;
        transform: string;
    };
    'context.conversation.recentMessages': {
        source: string;
        path: string;
        transform: string;
    };
    'context.conversation.topics': {
        source: string;
        resolver: string;
    };
    'context.conversation.decisions': {
        source: string;
        path: string;
        default: string;
    };
    'context.knowledge.relevantChunks': {
        source: string;
        path: string;
        default: string;
    };
    'context.assessment.axis': {
        source: string;
        path: string;
        default: string;
    };
    'context.assessment.currentLevel': {
        source: string;
        path: string;
        default: string;
    };
    'context.assessment.gaps': {
        source: string;
        path: string;
        transform: string;
    };
    'config.supported_languages': {
        source: string;
        key: string;
    };
    'config.app_name': {
        source: string;
        key: string;
    };
    'config.max_tokens': {
        source: string;
        key: string;
    };
    'runtime.datetime': {
        source: string;
        resolver: string;
    };
    'runtime.date': {
        source: string;
        resolver: string;
    };
    'runtime.timeOfDay': {
        source: string;
        resolver: string;
    };
};
export namespace APP_CONFIG {
    let supportedLanguages: string;
    let appName: string;
    let appVersion: string;
    let defaultLanguage: string;
    let maxResponseTokens: number;
}
//# sourceMappingURL=variableResolver.d.ts.map