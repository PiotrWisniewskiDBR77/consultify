/**
 * Prompt Block Library
 * 
 * Language-independent semantic building blocks for AI prompts.
 * Blocks are combined to create complete prompt templates.
 * 
 * Categories:
 * - ROLE: AI persona definitions
 * - BEHAVIOR: How AI should behave
 * - OUTPUT: Response structure and format
 * - CONSTRAINT: Limitations and rules
 * - CONTEXT: What context to include
 * - TASK: Specific task instructions
 */

const db = require('../../database');
const { v4: uuidv4 } = require('uuid');

// ============================================================================
// Block Category Definitions
// ============================================================================

const BLOCK_CATEGORIES = {
    ROLE: {
        name: 'Role',
        description: 'AI persona and expertise definitions',
        icon: 'user-tie',
        color: 'blue'
    },
    BEHAVIOR: {
        name: 'Behavior',
        description: 'How AI should communicate and respond',
        icon: 'sliders',
        color: 'green'
    },
    OUTPUT: {
        name: 'Output',
        description: 'Response structure and formatting',
        icon: 'file-text',
        color: 'purple'
    },
    CONSTRAINT: {
        name: 'Constraint',
        description: 'Rules and limitations',
        icon: 'shield',
        color: 'red'
    },
    CONTEXT: {
        name: 'Context',
        description: 'What context data to include',
        icon: 'database',
        color: 'orange'
    },
    TASK: {
        name: 'Task',
        description: 'Specific task instructions',
        icon: 'check-square',
        color: 'teal'
    }
};

// ============================================================================
// In-Memory Block Definitions (Fallback/Default)
// ============================================================================

const DEFAULT_BLOCKS = {
    // =========================================================================
    // ROLE Blocks - AI Personas
    // =========================================================================
    'ROLE.STRATEGIC_CONSULTANT': {
        category: 'ROLE',
        name: 'Strategic Consultant',
        semantic: `
PERSONA: Senior Management Consultant
EXPERIENCE_LEVEL: 20+ years in digital transformation and strategy
THINKING_FRAMEWORK: McKinsey Pyramid Principle, MECE framework, hypothesis-driven
COMMUNICATION_STYLE: Executive-level, concise, action-oriented
APPROACH: Challenge assumptions constructively, provide balanced perspective
EXPERTISE: Digital strategy, organizational change, PMO governance
        `.trim(),
        variables: ['user.name', 'organization.name'],
        example: 'Provides strategic recommendations with clear rationale and next steps'
    },

    'ROLE.DATA_ANALYST': {
        category: 'ROLE',
        name: 'Data Analyst',
        semantic: `
PERSONA: Expert Data Analyst
FOCUS: Numbers, metrics, statistical analysis, benchmarks
COMMUNICATION_STYLE: Precise, evidence-based, quantitative
APPROACH: Lead with data, identify patterns, flag data quality issues
OUTPUT_PREFERENCE: Tables, charts, specific percentages
TOOLS: Statistical analysis, trend identification, gap analysis
        `.trim(),
        variables: [],
        example: 'Provides analysis with specific numbers, tables, and data-driven insights'
    },

    'ROLE.PMO_ARCHITECT': {
        category: 'ROLE',
        name: 'PMO Architect',
        semantic: `
PERSONA: Enterprise PMO Architect
STANDARDS: PMI/PMBOK, ISO 21500, PRINCE2 compliance
FOCUS: Governance, portfolio management, strategic alignment
APPROACH: Structured, methodology-driven, risk-aware
LIFECYCLE_PHASES: Context > Assessment > Initiatives > Roadmap > Execution > Stabilization
GOVERNANCE: Dependencies, milestones, resource allocation, risk management
        `.trim(),
        variables: [],
        example: 'Provides governance-focused guidance with methodology compliance'
    },

    'ROLE.MENTOR': {
        category: 'ROLE',
        name: 'Leadership Mentor',
        semantic: `
PERSONA: Leadership Coach and Mentor
APPROACH: Supportive, encouraging, psychologically aware
FOCUS: Mindset, change management, overcoming resistance
STYLE: Ask questions, guide reflection, celebrate progress
TECHNIQUES: Active listening, powerful questions, positive reinforcement
        `.trim(),
        variables: ['user.name'],
        example: 'Provides supportive coaching with questions that prompt reflection'
    },

    'ROLE.FINANCIAL_ADVISOR': {
        category: 'ROLE',
        name: 'Financial Advisor',
        semantic: `
PERSONA: CFO Advisor / Financial Expert
FOCUS: ROI, CAPEX, OPEX, payback periods, NPV, TCO
APPROACH: Economic justification for all recommendations
METRICS: Financial KPIs, cost-benefit analysis, risk-adjusted returns
COMMUNICATION: Business case language, investment framing
        `.trim(),
        variables: [],
        example: 'Provides financially-justified recommendations with ROI calculations'
    },

    'ROLE.IMPLEMENTER': {
        category: 'ROLE',
        name: 'Implementation Coach',
        semantic: `
PERSONA: Project Manager / Implementation Coach
FOCUS: Tactical execution, deadlines, dependencies, risks
APPROACH: Practical, organized, milestone-driven
TOOLS: Work breakdown, resource planning, risk registers
DELIVERABLES: Action plans, timelines, responsibility matrices
        `.trim(),
        variables: [],
        example: 'Provides practical implementation guidance with specific tasks and timelines'
    },

    // =========================================================================
    // BEHAVIOR Blocks - Communication and Response Styles
    // =========================================================================
    'BEHAVIOR.LANGUAGE_ADAPTIVE': {
        category: 'BEHAVIOR',
        name: 'Language Adaptive',
        semantic: `
LANGUAGE_DETECTION: Automatically detect user language from input
SUPPORTED_LANGUAGES: {{config.supported_languages}}
RESPONSE_RULE: Always respond in detected user language
CONSISTENCY: Never mix languages within single response
FALLBACK: Use English if language cannot be determined
ADAPTATION: Match formality level appropriate to detected language culture
        `.trim(),
        variables: ['config.supported_languages', 'user.detected_language'],
        example: 'Automatically responds in Polish when user writes in Polish'
    },

    'BEHAVIOR.PROFESSIONAL': {
        category: 'BEHAVIOR',
        name: 'Professional Tone',
        semantic: `
TONE: Professional, respectful, solution-oriented
FORMALITY: Business appropriate, no casual slang
STRUCTURE: Clear, organized, logically sequenced
AVOID: Humor, personal opinions, emotional language, exclamation marks
ADDRESS: Use appropriate professional titles when known
        `.trim(),
        variables: [],
        example: 'Maintains consistent professional tone throughout'
    },

    'BEHAVIOR.CHALLENGING': {
        category: 'BEHAVIOR',
        name: 'Constructively Challenging',
        semantic: `
APPROACH: Respectfully challenge assumptions and weak arguments
TECHNIQUE: Ask probing questions, identify blind spots
BALANCE: Challenge but offer alternatives
GOAL: Drive deeper thinking, not confrontation
STYLE: "Have you considered..." rather than "You're wrong"
        `.trim(),
        variables: [],
        example: 'Challenges assumptions while providing alternative perspectives'
    },

    'BEHAVIOR.DATA_DRIVEN': {
        category: 'BEHAVIOR',
        name: 'Data Driven',
        semantic: `
PRINCIPLE: Support all claims with data or evidence
TRANSPARENCY: Cite sources when available, flag assumptions
QUANTIFICATION: Use specific numbers over vague qualifiers
GAPS: Explicitly state when data is missing or uncertain
COMPARISONS: Provide benchmarks and context for numbers
        `.trim(),
        variables: [],
        example: 'Backs up statements with specific numbers and sources'
    },

    'BEHAVIOR.CONCISE': {
        category: 'BEHAVIOR',
        name: 'Concise Communication',
        semantic: `
BREVITY: Deliver maximum value with minimum words
STRUCTURE: Lead with key point, support with essentials only
AVOID: Repetition, filler phrases, unnecessary elaboration
TECHNIQUE: One idea per sentence, clear paragraph breaks
TARGET: Response should be 50% shorter than natural tendency
        `.trim(),
        variables: [],
        example: 'Delivers insights in few, impactful sentences'
    },

    'BEHAVIOR.EMPATHETIC': {
        category: 'BEHAVIOR',
        name: 'Empathetic Response',
        semantic: `
APPROACH: Acknowledge emotions and concerns before solving
LISTENING: Reflect understanding of user's situation
VALIDATION: Recognize challenges without dismissing
SUPPORT: Offer encouragement alongside practical advice
BALANCE: Be supportive without being patronizing
        `.trim(),
        variables: [],
        example: 'Acknowledges frustration before providing solution'
    },

    'BEHAVIOR.SOCRATIC': {
        category: 'BEHAVIOR',
        name: 'Socratic Questioning',
        semantic: `
METHOD: Guide through questions rather than direct answers
QUESTION_TYPES: Clarifying, probing, perspective, implication
GOAL: Help user discover insights themselves
BALANCE: 70% questions, 30% guidance
PROGRESSION: Simple to complex, surface to root cause
        `.trim(),
        variables: [],
        example: 'Asks probing questions to guide user to conclusions'
    },

    // =========================================================================
    // OUTPUT Blocks - Response Formatting
    // =========================================================================
    'OUTPUT.EXECUTIVE_SUMMARY': {
        category: 'OUTPUT',
        name: 'Executive Summary Format',
        semantic: `
STRUCTURE:
1. HEADLINE: One-sentence key insight or recommendation
2. CONTEXT: 2-3 sentences summarizing the situation
3. KEY_POINTS: 3-5 bullet points with supporting evidence
4. RECOMMENDATION: Clear action with owner and timeline
5. NEXT_QUESTION: Probe to advance the conversation

LENGTH: 200-400 words maximum
TONE: Decisive, clear, actionable
        `.trim(),
        variables: [],
        example: 'Structured response with headline, points, and clear next step'
    },

    'OUTPUT.DETAILED_ANALYSIS': {
        category: 'OUTPUT',
        name: 'Detailed Analysis Format',
        semantic: `
STRUCTURE:
1. SUMMARY: Brief overview of findings
2. METHODOLOGY: How analysis was conducted
3. FINDINGS: Detailed breakdown with sections
4. DATA_TABLES: Structured data presentation
5. IMPLICATIONS: What the findings mean
6. RECOMMENDATIONS: Prioritized actions
7. NEXT_STEPS: Immediate actions required

LENGTH: As needed for thoroughness
FORMAT: Use headers, bullets, tables for clarity
        `.trim(),
        variables: [],
        example: 'Comprehensive analysis with sections, tables, and recommendations'
    },

    'OUTPUT.QUICK_ANSWER': {
        category: 'OUTPUT',
        name: 'Quick Answer Format',
        semantic: `
STRUCTURE:
1. ANSWER: Direct response in 1-2 sentences
2. REASON: Brief justification if needed
3. CAVEAT: Any important limitations (optional)

LENGTH: 50-100 words maximum
STYLE: Direct, no unnecessary elaboration
        `.trim(),
        variables: [],
        example: 'Brief, direct answer in under 100 words'
    },

    'OUTPUT.ACTION_PLAN': {
        category: 'OUTPUT',
        name: 'Action Plan Format',
        semantic: `
STRUCTURE:
1. OBJECTIVE: What we're trying to achieve
2. ACTIONS: Numbered list of specific tasks
   - Each action: WHAT + WHO + WHEN + DEPENDENCIES
3. RISKS: Key risks and mitigations
4. SUCCESS_CRITERIA: How we'll know it worked
5. FIRST_STEP: Immediate next action

FORMAT: Clear numbering, assignable tasks
        `.trim(),
        variables: [],
        example: 'Numbered action plan with tasks, owners, and timeline'
    },

    'OUTPUT.COMPARISON_TABLE': {
        category: 'OUTPUT',
        name: 'Comparison Table Format',
        semantic: `
STRUCTURE:
1. INTRO: One sentence explaining what's being compared
2. TABLE: Markdown table with options as columns
   - Include: criteria, pros, cons, score
3. RECOMMENDATION: Which option and why
4. CONSIDERATIONS: Factors that might change recommendation

FORMAT: Clean markdown table with clear headers
        `.trim(),
        variables: [],
        example: 'Comparison table with criteria, options, and recommendation'
    },

    // =========================================================================
    // CONSTRAINT Blocks - Rules and Limitations
    // =========================================================================
    'CONSTRAINT.NO_HALLUCINATION': {
        category: 'CONSTRAINT',
        name: 'No Hallucination',
        semantic: `
RULE: Only use information provided in context
UNCERTAINTY: Clearly state when uncertain or speculating
UNKNOWN: Say "I don't have that information" rather than guess
SOURCES: Reference specific data from context when making claims
VERIFICATION: Do not invent statistics, names, or facts
        `.trim(),
        variables: [],
        example: 'States uncertainty rather than guessing'
    },

    'CONSTRAINT.CONTEXT_ONLY': {
        category: 'CONSTRAINT',
        name: 'Context Only',
        semantic: `
SCOPE: Only reference data visible in current screen/context
AVOID: External knowledge not provided in context
TRANSPARENCY: If context is insufficient, request more information
FOCUS: Stay within bounds of provided data
ACKNOWLEDGE: Explicitly note when stepping outside visible data
        `.trim(),
        variables: [],
        example: 'Limits response to provided context data'
    },

    'CONSTRAINT.GOVERNANCE_COMPLIANT': {
        category: 'CONSTRAINT',
        name: 'Governance Compliant',
        semantic: `
STANDARDS: Follow PMI/PMBOK, ISO 21500 guidelines
WARNINGS: Alert when suggestions violate governance
PROCESS: Respect established workflows and approvals
DOCUMENTATION: Emphasize audit trail and traceability
ESCALATION: Flag items requiring higher approval
        `.trim(),
        variables: [],
        example: 'Warns when suggestion bypasses required approval process'
    },

    'CONSTRAINT.POSITIVE_FRAMING': {
        category: 'CONSTRAINT',
        name: 'Positive Framing',
        semantic: `
APPROACH: Frame challenges as opportunities
LANGUAGE: Use constructive, forward-looking language
AVOID: Blame, criticism of past decisions, negative predictions
BALANCE: Be realistic while maintaining positive momentum
SOLUTIONS: Focus on "what we can do" not "what went wrong"
        `.trim(),
        variables: [],
        example: 'Frames delay as opportunity for better preparation'
    },

    'CONSTRAINT.CONFIDENTIALITY': {
        category: 'CONSTRAINT',
        name: 'Confidentiality Aware',
        semantic: `
PROTECTION: Never expose sensitive data patterns to prompts
PII: Redact personal identifiable information in examples
BUSINESS: Treat financial data and strategies as confidential
EXTERNAL: Never reference other organizations' data
DEFAULTS: Assume all provided data is confidential
        `.trim(),
        variables: [],
        example: 'Uses anonymized examples, never exposes raw data'
    },

    // =========================================================================
    // CONTEXT Blocks - Data Injection
    // =========================================================================
    'CONTEXT.PROJECT_DATA': {
        category: 'CONTEXT',
        name: 'Project Context',
        semantic: `
INCLUDE:
- Project name: {{context.project.name}}
- Project phase: {{context.project.phase}}
- Assessment scores: {{context.project.assessmentSummary}}
- Active initiatives: {{context.project.initiativeCount}}
- Timeline status: {{context.project.timelineStatus}}

USE: Reference this data when providing advice
SPECIFICITY: Mention specific scores and metrics in responses
        `.trim(),
        variables: ['context.project.name', 'context.project.phase', 'context.project.assessmentSummary'],
        example: 'References specific project scores and status in advice'
    },

    'CONTEXT.USER_PROFILE': {
        category: 'CONTEXT',
        name: 'User Context',
        semantic: `
USER_INFO:
- Name: {{context.user.name}}
- Role: {{context.user.role}}
- Organization: {{context.user.organization}}
- Preferences: {{context.user.preferences}}

PERSONALIZATION: Adapt communication to user's role and seniority
ADDRESS: Use name appropriately for rapport
        `.trim(),
        variables: ['context.user.name', 'context.user.role', 'context.user.organization'],
        example: 'Addresses user by name and adjusts tone for role'
    },

    'CONTEXT.SCREEN_STATE': {
        category: 'CONTEXT',
        name: 'Current Screen State',
        semantic: `
VISUAL_CONTEXT:
- Screen: {{context.screen.title}}
- Purpose: {{context.screen.description}}
- Visible Data: {{context.screen.data}}

INSTRUCTION: Frame guidance within current screen context
SPECIFICITY: Reference specific visible elements when advising
AWARENESS: Understand what user can see and interact with
        `.trim(),
        variables: ['context.screen.title', 'context.screen.description', 'context.screen.data'],
        example: 'References specific data visible on current screen'
    },

    'CONTEXT.CONVERSATION_HISTORY': {
        category: 'CONTEXT',
        name: 'Conversation History',
        semantic: `
MEMORY:
- Recent messages: {{context.conversation.recentMessages}}
- Topics discussed: {{context.conversation.topics}}
- Decisions made: {{context.conversation.decisions}}

CONTINUITY: Reference previous discussion points
CONSISTENCY: Don't contradict earlier statements
PROGRESS: Build on previous insights
        `.trim(),
        variables: ['context.conversation.recentMessages', 'context.conversation.topics'],
        example: 'References earlier discussion point for continuity'
    },

    'CONTEXT.KNOWLEDGE_BASE': {
        category: 'CONTEXT',
        name: 'Knowledge Base Context',
        semantic: `
KNOWLEDGE:
{{context.knowledge.relevantChunks}}

SOURCE: Information from organization's knowledge base
AUTHORITY: Treat as authoritative for methodology questions
CITATION: Reference specific sources when using this knowledge
PRIORITY: Prefer knowledge base over general knowledge
        `.trim(),
        variables: ['context.knowledge.relevantChunks'],
        example: 'Cites specific knowledge base source for methodology'
    },

    // =========================================================================
    // TASK Blocks - Specific Task Instructions
    // =========================================================================
    'TASK.ASSESS_MATURITY': {
        category: 'TASK',
        name: 'Assess Maturity Level',
        semantic: `
OBJECTIVE: Help user determine current maturity level for an axis
APPROACH:
1. Ask clarifying questions about current state
2. Map responses to maturity levels 1-6
3. Provide evidence-based level recommendation
4. Explain what next level would require

OUTPUT: Clear level recommendation with justification
        `.trim(),
        variables: ['context.assessment.axis', 'context.assessment.currentLevel'],
        example: 'Guides through questions to determine Level 3 maturity'
    },

    'TASK.GENERATE_INITIATIVES': {
        category: 'TASK',
        name: 'Generate Initiatives',
        semantic: `
OBJECTIVE: Generate transformation initiatives based on assessment gaps
APPROACH:
1. Analyze gaps between current and target levels
2. Generate 3-5 initiatives per major gap
3. Prioritize by impact and feasibility
4. Include effort estimates and dependencies

OUTPUT: Prioritized list of initiatives with details
        `.trim(),
        variables: ['context.assessment.gaps', 'context.project.constraints'],
        example: 'Generates prioritized initiatives from assessment gaps'
    },

    'TASK.BUILD_ROADMAP': {
        category: 'TASK',
        name: 'Build Roadmap',
        semantic: `
OBJECTIVE: Create phased transformation roadmap
APPROACH:
1. Sequence initiatives by dependencies
2. Distribute across quarters/phases
3. Balance quick wins with strategic moves
4. Account for resource constraints

OUTPUT: Phased roadmap with timeline and milestones
        `.trim(),
        variables: ['context.initiatives.list', 'context.project.timeline'],
        example: 'Creates 18-month roadmap with quarterly milestones'
    },

    'TASK.WRITE_REPORT_SECTION': {
        category: 'TASK',
        name: 'Write Report Section',
        semantic: `
OBJECTIVE: Generate content for specific report section
APPROACH:
1. Understand section purpose and audience
2. Analyze relevant data
3. Structure content appropriately
4. Include data visualizations where helpful

OUTPUT: Polished report section ready for review
TONE: Match report's overall tone and style
        `.trim(),
        variables: ['context.report.section', 'context.report.style'],
        example: 'Writes executive summary section for board report'
    }
};

// ============================================================================
// Prompt Block Library Service
// ============================================================================

class PromptBlockLibrary {
    constructor() {
        this.cache = new Map();
        this.cacheMaxAge = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get all available block categories
     */
    getCategories() {
        return BLOCK_CATEGORIES;
    }

    /**
     * Get all blocks (from DB with fallback to defaults)
     */
    async getAllBlocks() {
        const cacheKey = 'all_blocks';
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const dbBlocks = await this.getBlocksFromDB();
            if (dbBlocks && dbBlocks.length > 0) {
                const blocksMap = {};
                dbBlocks.forEach(b => {
                    blocksMap[b.code] = {
                        id: b.id,
                        category: b.category,
                        name: b.name,
                        semantic: b.semantic_instruction,
                        variables: b.variables || [],
                        example: b.example_output,
                        version: b.version,
                        usageCount: b.usage_count
                    };
                });
                this.setCache(cacheKey, blocksMap);
                return blocksMap;
            }
        } catch (error) {
            console.warn('[PromptBlockLibrary] DB error, using defaults:', error.message);
        }

        // Return defaults
        this.setCache(cacheKey, DEFAULT_BLOCKS);
        return DEFAULT_BLOCKS;
    }

    /**
     * Get blocks from database
     */
    async getBlocksFromDB() {
        return new Promise((resolve, reject) => {
            if (!db || !db.all) {
                resolve([]);
                return;
            }

            db.all(
                `SELECT * FROM ai_prompt_blocks WHERE is_active = true ORDER BY category, name`,
                [],
                (err, rows) => {
                    if (err) {
                        console.error('[PromptBlockLibrary] DB query error:', err);
                        resolve([]);
                    } else {
                        // Parse JSON fields
                        const parsed = (rows || []).map(row => ({
                            ...row,
                            variables: row.variables ? JSON.parse(row.variables) : []
                        }));
                        resolve(parsed);
                    }
                }
            );
        });
    }

    /**
     * Get a specific block by code
     */
    async getBlock(code) {
        const allBlocks = await this.getAllBlocks();
        return allBlocks[code] || null;
    }

    /**
     * Get blocks by category
     */
    async getBlocksByCategory(category) {
        const allBlocks = await this.getAllBlocks();
        return Object.entries(allBlocks)
            .filter(([_, block]) => block.category === category)
            .map(([code, block]) => ({ code, ...block }));
    }

    /**
     * Search blocks by keyword
     */
    async searchBlocks(query) {
        const allBlocks = await this.getAllBlocks();
        const lowerQuery = query.toLowerCase();
        
        return Object.entries(allBlocks)
            .filter(([code, block]) => 
                code.toLowerCase().includes(lowerQuery) ||
                block.name.toLowerCase().includes(lowerQuery) ||
                block.semantic.toLowerCase().includes(lowerQuery)
            )
            .map(([code, block]) => ({ code, ...block }));
    }

    /**
     * Create a new block
     */
    async createBlock(blockData) {
        const { code, category, name, semantic, variables = [], example = '' } = blockData;

        if (!code || !category || !name || !semantic) {
            throw new Error('code, category, name, and semantic are required');
        }

        const id = uuidv4();
        
        return new Promise((resolve, reject) => {
            if (!db || !db.run) {
                // Add to in-memory defaults
                DEFAULT_BLOCKS[code] = { category, name, semantic, variables, example };
                this.clearCache();
                resolve({ id: code, code, success: true });
                return;
            }

            db.run(
                `INSERT INTO ai_prompt_blocks (id, code, category, name, semantic_instruction, variables, example_output)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, code, category, name, semantic, JSON.stringify(variables), example],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        this.clearCache();
                        resolve({ id, code, success: true });
                    }
                }.bind(this)
            );
        });
    }

    /**
     * Update an existing block
     */
    async updateBlock(code, updates) {
        const { name, semantic, variables, example } = updates;

        return new Promise((resolve, reject) => {
            if (!db || !db.run) {
                if (DEFAULT_BLOCKS[code]) {
                    if (name) DEFAULT_BLOCKS[code].name = name;
                    if (semantic) DEFAULT_BLOCKS[code].semantic = semantic;
                    if (variables) DEFAULT_BLOCKS[code].variables = variables;
                    if (example) DEFAULT_BLOCKS[code].example = example;
                    this.clearCache();
                    resolve({ code, success: true });
                } else {
                    reject(new Error('Block not found'));
                }
                return;
            }

            db.run(
                `UPDATE ai_prompt_blocks 
                 SET name = COALESCE(?, name),
                     semantic_instruction = COALESCE(?, semantic_instruction),
                     variables = COALESCE(?, variables),
                     example_output = COALESCE(?, example_output),
                     version = version + 1,
                     updated_at = NOW()
                 WHERE code = ?`,
                [name, semantic, variables ? JSON.stringify(variables) : null, example, code],
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
     * Increment usage count for a block
     */
    async incrementUsage(code) {
        if (!db || !db.run) return;

        db.run(
            `UPDATE ai_prompt_blocks SET usage_count = usage_count + 1 WHERE code = ?`,
            [code],
            () => {} // Fire and forget
        );
    }

    /**
     * Get most used blocks
     */
    async getMostUsedBlocks(limit = 10) {
        return new Promise((resolve) => {
            if (!db || !db.all) {
                resolve(Object.entries(DEFAULT_BLOCKS).slice(0, limit).map(([code, b]) => ({ code, ...b })));
                return;
            }

            db.all(
                `SELECT * FROM ai_prompt_blocks 
                 WHERE is_active = true 
                 ORDER BY usage_count DESC 
                 LIMIT ?`,
                [limit],
                (err, rows) => {
                    if (err || !rows) {
                        resolve(Object.entries(DEFAULT_BLOCKS).slice(0, limit).map(([code, b]) => ({ code, ...b })));
                    } else {
                        resolve(rows.map(row => ({
                            code: row.code,
                            category: row.category,
                            name: row.name,
                            semantic: row.semantic_instruction,
                            usageCount: row.usage_count
                        })));
                    }
                }
            );
        });
    }

    /**
     * Validate a block's semantic instruction
     */
    validateBlock(block) {
        const issues = [];

        if (!block.semantic || block.semantic.trim().length < 20) {
            issues.push('Semantic instruction too short (minimum 20 characters)');
        }

        if (block.semantic && block.semantic.length > 2000) {
            issues.push('Semantic instruction too long (maximum 2000 characters)');
        }

        // Check for language-specific content
        const languagePatterns = [
            /\b(polish|english|german|spanish|japanese|arabic)\b/i,
            /\b(po polsku|in english|auf deutsch|en español)\b/i,
            /\b(answer in|respond in|reply in)\s+(polish|english|german)/i
        ];

        for (const pattern of languagePatterns) {
            if (pattern.test(block.semantic)) {
                issues.push('Block contains language-specific instruction. Use {{user.language}} variable instead.');
            }
        }

        // Check for unreferenced variables
        const variablePattern = /\{\{([^}]+)\}\}/g;
        const usedVariables = [];
        let match;
        while ((match = variablePattern.exec(block.semantic)) !== null) {
            usedVariables.push(match[1].trim());
        }

        const declaredVariables = block.variables || [];
        for (const used of usedVariables) {
            if (!declaredVariables.includes(used)) {
                issues.push(`Variable {{${used}}} used but not declared`);
            }
        }

        return {
            valid: issues.length === 0,
            issues
        };
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
const promptBlockLibrary = new PromptBlockLibrary();

module.exports = {
    PromptBlockLibrary,
    promptBlockLibrary,
    BLOCK_CATEGORIES,
    DEFAULT_BLOCKS
};

