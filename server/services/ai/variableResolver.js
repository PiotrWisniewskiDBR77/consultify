/**
 * Variable Resolver
 * 
 * Resolves prompt template variables from various sources:
 * - context: Request context (user, project, organization, screen)
 * - i18n: Translation keys for language-specific content
 * - config: Application configuration
 * - runtime: Computed at runtime (functions)
 */

import { getDatabase } from '../../src/database/Database.ts';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';
import { promptBlockLibrary } from './promptBlockLibrary.js';

// ============================================================================
// Configuration
// ============================================================================

const APP_CONFIG = {
    supportedLanguages: 'en,pl,de,es,ja,ar',
    appName: 'Consultify',
    appVersion: '2.0',
    defaultLanguage: 'en',
    maxResponseTokens: 4000
};

// ============================================================================
// Built-in Runtime Functions
// ============================================================================

const RUNTIME_FUNCTIONS = {
    /**
     * Detect language from text input
     */
    detectLanguage: (text, context) => {
        if (!text) return context?.user?.language || 'en';

        // Simple language detection based on character patterns
        const patterns = {
            ja: /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/,  // Japanese
            ar: /[\u0600-\u06FF]/,                              // Arabic
            pl: /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/,                        // Polish
            de: /[äöüßÄÖÜ]/,                                    // German
            es: /[áéíóúñ¿¡ÁÉÍÓÚÑü]/                            // Spanish
        };

        for (const [lang, pattern] of Object.entries(patterns)) {
            if (pattern.test(text)) {
                return lang;
            }
        }

        // Default to user's preferred language or English
        return context?.user?.language || 'en';
    },

    /**
     * Get current date/time
     */
    getCurrentDateTime: () => new Date().toISOString(),

    /**
     * Get current date formatted
     */
    getCurrentDate: () => new Date().toISOString().split('T')[0],

    /**
     * Get time of day greeting context
     */
    getTimeOfDayContext: () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'morning';
        if (hour < 17) return 'afternoon';
        return 'evening';
    },

    /**
     * Format assessment summary for prompt
     */
    formatAssessmentSummary: (context) => {
        const assessment = context?.project?.assessment;
        if (!assessment) return 'No assessment data available';

        const summary = [];
        if (assessment.overallScore !== undefined) {
            summary.push(`Overall Score: ${assessment.overallScore}/6`);
        }
        if (assessment.strengths?.length) {
            summary.push(`Strengths: ${assessment.strengths.join(', ')}`);
        }
        if (assessment.gaps?.length) {
            summary.push(`Gaps: ${assessment.gaps.join(', ')}`);
        }
        return summary.join('\n') || 'Assessment in progress';
    },

    /**
     * Format initiative list for prompt
     */
    formatInitiativeList: (context) => {
        const initiatives = context?.project?.initiatives;
        if (!initiatives?.length) return 'No initiatives defined';

        return initiatives
            .slice(0, 5)
            .map((i, idx) => `${idx + 1}. ${i.name} (${i.status || 'planned'})`)
            .join('\n');
    },

    /**
     * Get conversation context summary
     */
    summarizeConversation: (context) => {
        const messages = context?.conversation?.recentMessages;
        if (!messages?.length) return 'New conversation';

        const topics = new Set();
        messages.forEach(m => {
            // Extract potential topics from messages
            const words = (m.content || '').toLowerCase().split(/\s+/);
            const keywords = ['assessment', 'initiative', 'roadmap', 'report', 'budget', 'timeline', 'risk'];
            words.forEach(w => {
                if (keywords.some(k => w.includes(k))) {
                    topics.add(w);
                }
            });
        });

        return topics.size > 0
            ? `Topics discussed: ${[...topics].join(', ')}`
            : `${messages.length} messages exchanged`;
    }
};

// ============================================================================
// Variable Definitions (Fallback)
// ============================================================================

const DEFAULT_VARIABLES = {
    // User context
    'user.language': { source: 'context', path: 'user.language', default: 'en' },
    'user.name': { source: 'context', path: 'user.firstName', default: 'User' },
    'user.fullName': { source: 'context', path: 'user.fullName', default: 'User' },
    'user.role': { source: 'context', path: 'user.role', default: 'user' },
    'user.detected_language': { source: 'function', resolver: 'detectLanguage' },

    // Organization context
    'organization.name': { source: 'context', path: 'organization.name', default: 'Organization' },
    'organization.industry': { source: 'context', path: 'organization.industry', default: '' },
    'organization.size': { source: 'context', path: 'organization.size', default: '' },

    // Project context
    'context.project.name': { source: 'context', path: 'project.name', default: '' },
    'context.project.phase': { source: 'context', path: 'project.phase', default: 'discovery' },
    'context.project.assessmentSummary': { source: 'function', resolver: 'formatAssessmentSummary' },
    'context.project.initiativeCount': { source: 'context', path: 'project.initiativeCount', default: '0' },
    'context.project.initiativeList': { source: 'function', resolver: 'formatInitiativeList' },
    'context.project.timelineStatus': { source: 'context', path: 'project.timelineStatus', default: 'not started' },
    'context.project.constraints': { source: 'context', path: 'project.constraints', default: '' },

    // Screen context
    'context.screen.title': { source: 'context', path: 'screen._meta.title', default: '' },
    'context.screen.description': { source: 'context', path: 'screen._meta.description', default: '' },
    'context.screen.data': { source: 'context', path: 'screen', transform: 'json' },

    // Conversation context
    'context.conversation.recentMessages': { source: 'context', path: 'conversation.recentMessages', transform: 'json' },
    'context.conversation.topics': { source: 'function', resolver: 'summarizeConversation' },
    'context.conversation.decisions': { source: 'context', path: 'conversation.decisions', default: '' },

    // Knowledge context
    'context.knowledge.relevantChunks': { source: 'context', path: 'knowledge.chunks', default: '' },

    // Assessment context
    'context.assessment.axis': { source: 'context', path: 'assessment.currentAxis', default: '' },
    'context.assessment.currentLevel': { source: 'context', path: 'assessment.currentLevel', default: '' },
    'context.assessment.gaps': { source: 'context', path: 'assessment.gaps', transform: 'json' },

    // Config
    'config.supported_languages': { source: 'config', key: 'supportedLanguages' },
    'config.app_name': { source: 'config', key: 'appName' },
    'config.max_tokens': { source: 'config', key: 'maxResponseTokens' },

    // Runtime
    'runtime.datetime': { source: 'function', resolver: 'getCurrentDateTime' },
    'runtime.date': { source: 'function', resolver: 'getCurrentDate' },
    'runtime.timeOfDay': { source: 'function', resolver: 'getTimeOfDayContext' }
};

// ============================================================================
// Variable Resolver Class
// ============================================================================

class VariableResolver {
    constructor() {
        this.variableCache = new Map();
        this.customFunctions = {};
    }

    /**
     * Resolve all variables in a template string
     * @param {string} template - Template with {{variable}} placeholders
     * @param {object} context - Context object with data
     * @param {object} options - Resolution options
     * @returns {string} Template with resolved variables
     */
    async resolveTemplate(template, context = {}, options = {}) {
        if (!template) return '';

        const variablePattern = /\{\{([^}]+)\}\}/g;
        const variables = [];
        let match;

        // Find all variables
        while ((match = variablePattern.exec(template)) !== null) {
            variables.push(match[1].trim());
        }

        if (variables.length === 0) return template;

        // Resolve all variables
        const resolutions = {};
        for (const varCode of variables) {
            resolutions[varCode] = await this.resolveVariable(varCode, context, options);
        }

        // Replace in template
        let result = template;
        for (const [varCode, value] of Object.entries(resolutions)) {
            const pattern = new RegExp(`\\{\\{\\s*${this.escapeRegex(varCode)}\\s*\\}\\}`, 'g');
            result = result.replace(pattern, value);
        }

        return result;
    }

    /**
     * Resolve a single variable
     */
    async resolveVariable(varCode, context = {}, options = {}) {
        // Get variable definition
        const varDef = await this.getVariableDefinition(varCode);

        if (!varDef) {
            console.warn(`[VariableResolver] Unknown variable: ${varCode}`);
            return options.keepUnresolved ? `{{${varCode}}}` : '';
        }

        try {
            let value;

            switch (varDef.source) {
                case 'context':
                    value = this.getNestedValue(context, varDef.path);
                    break;

                case 'config':
                    value = APP_CONFIG[varDef.key];
                    break;

                case 'function':
                    const fn = RUNTIME_FUNCTIONS[varDef.resolver] || this.customFunctions[varDef.resolver];
                    if (fn) {
                        // Pass the user's message content for language detection
                        const messageContent = context?.lastUserMessage || context?.messages?.[context.messages.length - 1]?.content;
                        value = await fn(messageContent, context);
                    }
                    break;

                case 'i18n':
                    value = await this.resolveI18n(varDef.key, context.user?.language || 'en');
                    break;

                default:
                    value = null;
            }

            // Apply transforms
            if (varDef.transform === 'json' && typeof value === 'object') {
                value = JSON.stringify(value, null, 2);
            }

            // Apply default if value is null/undefined/empty
            if (value === null || value === undefined || value === '') {
                value = varDef.default || '';
            }

            return String(value);
        } catch (error) {
            console.error(`[VariableResolver] Error resolving ${varCode}:`, error);
            return varDef.default || '';
        }
    }

    /**
     * Get variable definition from DB or defaults
     */
    async getVariableDefinition(varCode) {
        // Check defaults first
        if (DEFAULT_VARIABLES[varCode]) {
            return DEFAULT_VARIABLES[varCode];
        }

        // Try database
        try {
            const dbVar = await this.getVariableFromDB(varCode);
            if (dbVar) {
                return {
                    source: dbVar.source,
                    path: dbVar.resolver_path,
                    key: dbVar.resolver_function,
                    resolver: dbVar.resolver_function,
                    default: dbVar.default_value
                };
            }
        } catch (error) {
            console.warn('[VariableResolver] DB lookup failed:', error.message);
        }

        return null;
    }

    /**
     * Get variable definition from database
     */
    async getVariableFromDB(code) {
        return new Promise((resolve) => {
            if (!db || !db.get) {
                resolve(null);
                return;
            }

            db.get(
                `SELECT * FROM ai_prompt_variables WHERE code = ?`,
                [code],
                (err, row) => {
                    resolve(err ? null : row);
                }
            );
        });
    }

    /**
     * Get nested value from object using dot notation
     */
    getNestedValue(obj, path) {
        if (!path) return obj;

        const parts = path.split('.');
        let value = obj;

        for (const part of parts) {
            if (value === null || value === undefined) return undefined;
            value = value[part];
        }

        return value;
    }

    /**
     * Resolve i18n translation key
     */
    async resolveI18n(key, language = 'en') {
        // This would integrate with the application's i18n system
        // For now, return the key as placeholder
        return `[${language}:${key}]`;
    }

    /**
     * Register a custom resolver function
     */
    registerFunction(name, fn) {
        if (typeof fn !== 'function') {
            throw new Error('Resolver must be a function');
        }
        this.customFunctions[name] = fn;
    }

    /**
     * Get list of all available variables
     */
    async getAvailableVariables() {
        const variables = [];

        // Add defaults
        for (const [code, def] of Object.entries(DEFAULT_VARIABLES)) {
            variables.push({
                code,
                source: def.source,
                description: this.getVariableDescription(code),
                default: def.default
            });
        }

        // Add from database
        try {
            const dbVars = await this.getAllVariablesFromDB();
            for (const v of dbVars) {
                if (!variables.find(x => x.code === v.code)) {
                    variables.push({
                        code: v.code,
                        source: v.source,
                        description: v.description,
                        default: v.default_value
                    });
                }
            }
        } catch (error) {
            console.warn('[VariableResolver] Could not load DB variables');
        }

        return variables;
    }

    /**
     * Get all variables from database
     */
    async getAllVariablesFromDB() {
        return new Promise((resolve) => {
            if (!db || !db.all) {
                resolve([]);
                return;
            }

            db.all(
                `SELECT * FROM ai_prompt_variables ORDER BY category, code`,
                [],
                (err, rows) => {
                    resolve(err ? [] : rows || []);
                }
            );
        });
    }

    /**
     * Get human-readable description for a variable
     */
    getVariableDescription(code) {
        const descriptions = {
            'user.language': 'User\'s preferred language code (en, pl, de, etc.)',
            'user.name': 'User\'s first name for personalization',
            'user.role': 'User\'s role in the organization',
            'user.detected_language': 'Language auto-detected from user input',
            'organization.name': 'Organization/company name',
            'context.project.name': 'Current project name',
            'context.project.phase': 'Current project phase in lifecycle',
            'context.screen.title': 'Current screen/page title',
            'context.screen.data': 'Data visible on current screen (JSON)',
            'config.supported_languages': 'Comma-separated list of supported languages'
        };
        return descriptions[code] || `Variable: ${code}`;
    }

    /**
     * Validate that all required variables can be resolved
     */
    async validateVariables(template, context) {
        const variablePattern = /\{\{([^}]+)\}\}/g;
        const issues = [];
        let match;

        while ((match = variablePattern.exec(template)) !== null) {
            const varCode = match[1].trim();
            const value = await this.resolveVariable(varCode, context, { keepUnresolved: true });

            if (value === `{{${varCode}}}` || value === '') {
                const def = await this.getVariableDefinition(varCode);
                if (def) {
                    issues.push({
                        variable: varCode,
                        issue: 'Value is empty or missing in context',
                        default: def.default
                    });
                } else {
                    issues.push({
                        variable: varCode,
                        issue: 'Unknown variable - not defined in system',
                        default: null
                    });
                }
            }
        }

        return {
            valid: issues.filter(i => i.issue.includes('Unknown')).length === 0,
            issues
        };
    }

    /**
     * Escape regex special characters
     */
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

// Singleton instance
const variableResolver = new VariableResolver();

export { VariableResolver, variableResolver, RUNTIME_FUNCTIONS, DEFAULT_VARIABLES, APP_CONFIG };
export default variableResolver;
