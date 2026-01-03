/**
 * Prompt Template Service
 * 
 * Manages language-independent prompt templates composed of reusable blocks.
 * Assembles final prompts by:
 * 1. Loading template definition
 * 2. Fetching referenced blocks
 * 3. Resolving all variables
 * 4. Composing final prompt string
 */

const db = require('../../database');
import { v4 as uuidv4 } from 'uuid';
const { promptBlockLibrary, DEFAULT_BLOCKS } = require('./promptBlockLibrary');
const { variableResolver } = require('./variableResolver');

// ============================================================================
// Default Templates (Fallback)
// ============================================================================

const DEFAULT_TEMPLATES = {
    'CHAT_STRATEGIC': {
        name: 'Strategic Chat Assistant',
        category: 'chat',
        description: 'Main chat assistant with strategic consulting capabilities',
        blocks: [
            'ROLE.STRATEGIC_CONSULTANT',
            'BEHAVIOR.LANGUAGE_ADAPTIVE',
            'BEHAVIOR.PROFESSIONAL',
            'BEHAVIOR.DATA_DRIVEN',
            'CONTEXT.USER_PROFILE',
            'CONTEXT.PROJECT_DATA',
            'OUTPUT.EXECUTIVE_SUMMARY',
            'CONSTRAINT.NO_HALLUCINATION'
        ],
        variableSchema: {
            'user.name': { required: false },
            'user.language': { required: true }
        },
        config: { temperature: 0.7, maxTokens: 2000 }
    },

    'ASSESSMENT_COACH': {
        name: 'Assessment Coach',
        category: 'assessment',
        description: 'AI coach for guiding users through digital maturity assessments',
        blocks: [
            'ROLE.PMO_ARCHITECT',
            'BEHAVIOR.LANGUAGE_ADAPTIVE',
            'BEHAVIOR.CHALLENGING',
            'CONTEXT.USER_PROFILE',
            'CONTEXT.SCREEN_STATE',
            'OUTPUT.QUICK_ANSWER',
            'CONSTRAINT.CONTEXT_ONLY'
        ],
        variableSchema: {
            'context.screen.data': { required: true }
        },
        config: { temperature: 0.5, maxTokens: 1500 }
    },

    'REPORT_GENERATOR': {
        name: 'Report Generator',
        category: 'report',
        description: 'AI for generating structured transformation reports',
        blocks: [
            'ROLE.DATA_ANALYST',
            'BEHAVIOR.LANGUAGE_ADAPTIVE',
            'BEHAVIOR.DATA_DRIVEN',
            'CONTEXT.PROJECT_DATA',
            'OUTPUT.DETAILED_ANALYSIS',
            'CONSTRAINT.NO_HALLUCINATION',
            'CONSTRAINT.GOVERNANCE_COMPLIANT'
        ],
        variableSchema: {
            'context.project.name': { required: true }
        },
        config: { temperature: 0.3, maxTokens: 4000 }
    },

    'INITIATIVE_GENERATOR': {
        name: 'Initiative Generator',
        category: 'initiatives',
        description: 'AI for generating transformation initiatives from assessment gaps',
        blocks: [
            'ROLE.STRATEGIC_CONSULTANT',
            'BEHAVIOR.LANGUAGE_ADAPTIVE',
            'BEHAVIOR.DATA_DRIVEN',
            'TASK.GENERATE_INITIATIVES',
            'CONTEXT.PROJECT_DATA',
            'OUTPUT.ACTION_PLAN',
            'CONSTRAINT.NO_HALLUCINATION'
        ],
        variableSchema: {
            'context.assessment.gaps': { required: true }
        },
        config: { temperature: 0.6, maxTokens: 3000 }
    },

    'MENTOR_COACH': {
        name: 'Mentor Coach',
        category: 'coaching',
        description: 'Supportive mentor for change management and leadership',
        blocks: [
            'ROLE.MENTOR',
            'BEHAVIOR.LANGUAGE_ADAPTIVE',
            'BEHAVIOR.EMPATHETIC',
            'BEHAVIOR.SOCRATIC',
            'CONTEXT.USER_PROFILE',
            'OUTPUT.QUICK_ANSWER',
            'CONSTRAINT.POSITIVE_FRAMING'
        ],
        variableSchema: {},
        config: { temperature: 0.8, maxTokens: 1500 }
    },

    'QUICK_ANALYST': {
        name: 'Quick Analyst',
        category: 'analysis',
        description: 'Fast data analysis for quick insights',
        blocks: [
            'ROLE.DATA_ANALYST',
            'BEHAVIOR.LANGUAGE_ADAPTIVE',
            'BEHAVIOR.CONCISE',
            'CONTEXT.SCREEN_STATE',
            'OUTPUT.QUICK_ANSWER',
            'CONSTRAINT.CONTEXT_ONLY'
        ],
        variableSchema: {},
        config: { temperature: 0.3, maxTokens: 500 }
    }
};

// ============================================================================
// Prompt Template Service Class
// ============================================================================

class PromptTemplateService {
    constructor() {
        this.cache = new Map();
        this.cacheMaxAge = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get a template by code
     */
    async getTemplate(code) {
        const cacheKey = `template_${code}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        // Try database first
        try {
            const dbTemplate = await this.getTemplateFromDB(code);
            if (dbTemplate) {
                this.setCache(cacheKey, dbTemplate);
                return dbTemplate;
            }
        } catch (error) {
            console.warn('[PromptTemplateService] DB error, using defaults:', error.message);
        }

        // Fallback to defaults
        if (DEFAULT_TEMPLATES[code]) {
            const template = {
                code,
                ...DEFAULT_TEMPLATES[code]
            };
            this.setCache(cacheKey, template);
            return template;
        }

        return null;
    }

    /**
     * Get template from database
     */
    async getTemplateFromDB(code) {
        return new Promise((resolve) => {
            if (!db || !db.get) {
                resolve(null);
                return;
            }

            db.get(
                `SELECT * FROM ai_prompt_templates WHERE code = ? AND is_active = true`,
                [code],
                (err, row) => {
                    if (err || !row) {
                        resolve(null);
                    } else {
                        resolve({
                            id: row.id,
                            code: row.code,
                            name: row.name,
                            category: row.category,
                            description: row.description,
                            blocks: JSON.parse(row.template_blocks || '[]'),
                            variableSchema: JSON.parse(row.variable_schema || '{}'),
                            config: JSON.parse(row.config || '{}'),
                            version: row.version
                        });
                    }
                }
            );
        });
    }

    /**
     * Assemble a complete prompt from template and context
     */
    async assemblePrompt(templateCode, context = {}) {
        const template = await this.getTemplate(templateCode);
        if (!template) {
            throw new Error(`Template not found: ${templateCode}`);
        }

        // 1. Fetch all blocks
        const blocks = [];
        for (const blockCode of template.blocks) {
            const block = await promptBlockLibrary.getBlock(blockCode);
            if (block) {
                blocks.push({ code: blockCode, ...block });
                // Increment usage
                promptBlockLibrary.incrementUsage(blockCode);
            } else {
                console.warn(`[PromptTemplateService] Block not found: ${blockCode}`);
            }
        }

        // 2. Compose raw prompt from blocks
        const sections = [];
        
        // Group blocks by category for organized output
        const categoryOrder = ['ROLE', 'BEHAVIOR', 'CONTEXT', 'TASK', 'OUTPUT', 'CONSTRAINT'];
        const blocksByCategory = {};
        
        for (const block of blocks) {
            const cat = block.category;
            if (!blocksByCategory[cat]) blocksByCategory[cat] = [];
            blocksByCategory[cat].push(block);
        }

        for (const category of categoryOrder) {
            if (blocksByCategory[category]?.length) {
                const categoryBlocks = blocksByCategory[category];
                sections.push(`# ${this.getCategoryLabel(category)}\n`);
                
                for (const block of categoryBlocks) {
                    sections.push(block.semantic.trim());
                    sections.push('');
                }
            }
        }

        const rawPrompt = sections.join('\n');

        // 3. Resolve all variables
        const resolvedPrompt = await variableResolver.resolveTemplate(rawPrompt, context);

        // 4. Add language instruction at the end
        const userLanguage = await variableResolver.resolveVariable('user.detected_language', context) ||
                            await variableResolver.resolveVariable('user.language', context) ||
                            'en';
        
        const languageInstruction = this.getLanguageInstruction(userLanguage);

        const finalPrompt = `${resolvedPrompt}\n\n# RESPONSE LANGUAGE\n${languageInstruction}`;

        return {
            template: template,
            prompt: finalPrompt,
            blocks: blocks.map(b => b.code),
            config: template.config,
            metadata: {
                resolvedAt: new Date().toISOString(),
                language: userLanguage,
                blockCount: blocks.length,
                characterCount: finalPrompt.length
            }
        };
    }

    /**
     * Get category label for prompt section
     */
    getCategoryLabel(category) {
        const labels = {
            'ROLE': 'PERSONA & EXPERTISE',
            'BEHAVIOR': 'COMMUNICATION STYLE',
            'CONTEXT': 'CONTEXT DATA',
            'TASK': 'TASK INSTRUCTIONS',
            'OUTPUT': 'OUTPUT FORMAT',
            'CONSTRAINT': 'RULES & CONSTRAINTS'
        };
        return labels[category] || category;
    }

    /**
     * Get language instruction (language-agnostic approach)
     */
    getLanguageInstruction(languageCode) {
        // Instead of hardcoding language names, we use a semantic instruction
        return `DETECTED_USER_LANGUAGE: ${languageCode}
INSTRUCTION: Respond entirely in the detected user language.
CONSISTENCY: Use consistent terminology throughout the response.
FORMALITY: Match formality conventions appropriate for the detected language culture.`;
    }

    /**
     * Get all available templates
     */
    async getAllTemplates() {
        const templates = [];

        // Add defaults
        for (const [code, def] of Object.entries(DEFAULT_TEMPLATES)) {
            templates.push({
                code,
                name: def.name,
                category: def.category,
                description: def.description,
                blockCount: def.blocks.length,
                source: 'default'
            });
        }

        // Add from database
        try {
            const dbTemplates = await this.getAllTemplatesFromDB();
            for (const t of dbTemplates) {
                const existing = templates.find(x => x.code === t.code);
                if (existing) {
                    // Override with DB version
                    Object.assign(existing, t, { source: 'database' });
                } else {
                    templates.push({ ...t, source: 'database' });
                }
            }
        } catch (error) {
            console.warn('[PromptTemplateService] Could not load DB templates');
        }

        return templates;
    }

    /**
     * Get all templates from database
     */
    async getAllTemplatesFromDB() {
        return new Promise((resolve) => {
            if (!db || !db.all) {
                resolve([]);
                return;
            }

            db.all(
                `SELECT id, code, name, category, description, template_blocks, version 
                 FROM ai_prompt_templates 
                 WHERE is_active = true 
                 ORDER BY category, name`,
                [],
                (err, rows) => {
                    if (err || !rows) {
                        resolve([]);
                    } else {
                        resolve(rows.map(row => ({
                            id: row.id,
                            code: row.code,
                            name: row.name,
                            category: row.category,
                            description: row.description,
                            blockCount: JSON.parse(row.template_blocks || '[]').length,
                            version: row.version
                        })));
                    }
                }
            );
        });
    }

    /**
     * Create a new template
     */
    async createTemplate(templateData) {
        const { code, name, category, description, blocks = [], variableSchema = {}, config = {} } = templateData;

        if (!code || !name || !category) {
            throw new Error('code, name, and category are required');
        }

        // Validate blocks exist
        for (const blockCode of blocks) {
            const block = await promptBlockLibrary.getBlock(blockCode);
            if (!block) {
                throw new Error(`Block not found: ${blockCode}`);
            }
        }

        const id = uuidv4();

        return new Promise((resolve, reject) => {
            if (!db || !db.run) {
                // Add to in-memory defaults
                DEFAULT_TEMPLATES[code] = {
                    name,
                    category,
                    description,
                    blocks,
                    variableSchema,
                    config
                };
                this.clearCache();
                resolve({ id: code, code, success: true });
                return;
            }

            db.run(
                `INSERT INTO ai_prompt_templates 
                 (id, code, name, category, description, template_blocks, variable_schema, config)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, code, name, category, description,
                    JSON.stringify(blocks),
                    JSON.stringify(variableSchema),
                    JSON.stringify(config)
                ],
                (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.clearCache();
                        
                        // Create version record
                        db.run(
                            `INSERT INTO ai_prompt_template_versions 
                             (id, template_id, version, template_blocks, variable_schema, config)
                             VALUES (?, ?, 1, ?, ?, ?)`,
                            [uuidv4(), id, JSON.stringify(blocks), JSON.stringify(variableSchema), JSON.stringify(config)],
                            () => {} // Fire and forget
                        );

                        resolve({ id, code, success: true });
                    }
                }
            );
        });
    }

    /**
     * Update an existing template
     */
    async updateTemplate(code, updates) {
        const existing = await this.getTemplate(code);
        if (!existing) {
            throw new Error(`Template not found: ${code}`);
        }

        const { name, description, blocks, variableSchema, config } = updates;

        // Validate new blocks if provided
        if (blocks) {
            for (const blockCode of blocks) {
                const block = await promptBlockLibrary.getBlock(blockCode);
                if (!block) {
                    throw new Error(`Block not found: ${blockCode}`);
                }
            }
        }

        return new Promise((resolve, reject) => {
            if (!db || !db.run) {
                if (DEFAULT_TEMPLATES[code]) {
                    if (name) DEFAULT_TEMPLATES[code].name = name;
                    if (description) DEFAULT_TEMPLATES[code].description = description;
                    if (blocks) DEFAULT_TEMPLATES[code].blocks = blocks;
                    if (variableSchema) DEFAULT_TEMPLATES[code].variableSchema = variableSchema;
                    if (config) DEFAULT_TEMPLATES[code].config = config;
                    this.clearCache();
                    resolve({ code, success: true });
                } else {
                    reject(new Error('Template not found'));
                }
                return;
            }

            db.run(
                `UPDATE ai_prompt_templates 
                 SET name = COALESCE(?, name),
                     description = COALESCE(?, description),
                     template_blocks = COALESCE(?, template_blocks),
                     variable_schema = COALESCE(?, variable_schema),
                     config = COALESCE(?, config),
                     version = version + 1,
                     updated_at = NOW()
                 WHERE code = ?`,
                [
                    name,
                    description,
                    blocks ? JSON.stringify(blocks) : null,
                    variableSchema ? JSON.stringify(variableSchema) : null,
                    config ? JSON.stringify(config) : null,
                    code
                ],
                (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.clearCache();
                        resolve({ code, success: true });
                    }
                }
            );
        });
    }

    /**
     * Validate a template
     */
    async validateTemplate(templateCode, context = {}) {
        const issues = [];

        const template = await this.getTemplate(templateCode);
        if (!template) {
            return { valid: false, issues: [{ severity: 'error', message: 'Template not found' }] };
        }

        // Check all blocks exist
        for (const blockCode of template.blocks) {
            const block = await promptBlockLibrary.getBlock(blockCode);
            if (!block) {
                issues.push({ severity: 'error', message: `Block not found: ${blockCode}` });
            } else {
                // Validate block
                const blockValidation = promptBlockLibrary.validateBlock(block);
                if (!blockValidation.valid) {
                    blockValidation.issues.forEach(i => {
                        issues.push({ severity: 'warning', message: `${blockCode}: ${i}` });
                    });
                }
            }
        }

        // Check required variables can be resolved
        try {
            const assembled = await this.assemblePrompt(templateCode, context);
            const varValidation = await variableResolver.validateVariables(assembled.prompt, context);
            
            for (const issue of varValidation.issues) {
                if (issue.issue.includes('Unknown')) {
                    issues.push({ severity: 'error', message: `Unknown variable: ${issue.variable}` });
                } else {
                    issues.push({ severity: 'info', message: `Variable ${issue.variable}: ${issue.issue}` });
                }
            }
        } catch (error) {
            issues.push({ severity: 'error', message: `Assembly error: ${error.message}` });
        }

        // Check for recommended blocks
        const hasLanguageBlock = template.blocks.some(b => b.includes('LANGUAGE_ADAPTIVE'));
        if (!hasLanguageBlock) {
            issues.push({ 
                severity: 'warning', 
                message: 'Template missing BEHAVIOR.LANGUAGE_ADAPTIVE block for multilingual support' 
            });
        }

        return {
            valid: issues.filter(i => i.severity === 'error').length === 0,
            issues
        };
    }

    /**
     * Preview a template with sample context
     */
    async previewTemplate(templateCode, language = 'en') {
        const sampleContext = {
            user: {
                firstName: 'Jan',
                role: 'admin',
                language: language
            },
            organization: {
                name: 'Sample Company',
                industry: 'Manufacturing'
            },
            project: {
                name: 'Digital Transformation 2025',
                phase: 'assessment',
                initiativeCount: 5
            },
            screen: {
                _meta: {
                    title: 'Assessment Dashboard',
                    description: 'Overview of assessment progress'
                },
                data: { score: 3.5, progress: 65 }
            },
            lastUserMessage: language === 'pl' ? 'Jak mogę poprawić wynik?' : 'How can I improve the score?'
        };

        return this.assemblePrompt(templateCode, sampleContext);
    }

    /**
     * Get templates by category
     */
    async getTemplatesByCategory(category) {
        const all = await this.getAllTemplates();
        return all.filter(t => t.category === category);
    }

    // =========================================================================
    // Cache Management
    // =========================================================================

    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > this.cacheMaxAge) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }

    setCache(key, data) {
        this.cache.set(key, { data, timestamp: Date.now() });
    }

    clearCache() {
        this.cache.clear();
    }
}

// Singleton instance
const promptTemplateService = new PromptTemplateService();

export default {
    PromptTemplateService,
    promptTemplateService,
    DEFAULT_TEMPLATES
};

