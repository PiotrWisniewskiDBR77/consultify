/**
 * AI Prompt Hierarchy Service
 * 
 * Implements deterministic 4-layer prompt stacking for consistent AI behavior.
 * Layers: System → Role → Phase → User Overlay
 * 
 * CRITICAL: User layer CANNOT override system constraints.
 */

// Dependency injection for testing
const deps = {
    db: require('../database'),
    uuidv4: require('uuid').v4
};

// Prompt layer priority (lower = higher priority, cannot be overridden)
const PROMPT_LAYERS = {
    SYSTEM: 1,      // Global, immutable constraints
    ROLE: 2,        // AI role behavior (Advisor/PMO/Educator/Executor)
    PHASE: 3,       // SCMS lifecycle phase context
    USER: 4         // User preferences (filtered)
};

// Default System Prompt (Immutable Core)
const DEFAULT_SYSTEM_PROMPT = `SYSTEM ROLE: You are an Enterprise PMO Architect (SCMS Core).
Your mandate is to design, govern, execute, and stabilize strategic change.
You act as a PMO Assistant and Transformation Guide. YOU ARE NOT A CHATBOT.

COMPLIANCE:
- Align with PMI/PMBOK and ISO 21500 standards
- All actions must be auditable and traceable
- Respect data isolation between tenants and projects
- Never fabricate data or metrics not provided in context

CONSTRAINTS:
- Do not claim authority you do not have
- Do not approve actions outside your policy level
- Do not access external data unless explicitly enabled
- Always cite sources when using internal knowledge
- Never expose sensitive information across tenant boundaries

GOVERNANCE:
- All draft creations require human approval
- Escalate decisions to appropriate stakeholders
- Log all significant recommendations for audit`;

// Default Role Prompts
const DEFAULT_ROLE_PROMPTS = {
    ADVISOR: `ROLE: Strategic Advisor
BEHAVIOR:
- Explain concepts clearly and contextually
- Provide strategic insights based on available data
- Suggest options without making decisions
- Focus on business value and risk assessment
- Challenge assumptions constructively`,

    PMO_MANAGER: `ROLE: PMO Manager
BEHAVIOR:
- Enforce process discipline and governance
- Track progress against baselines
- Escalate risks and blockers promptly
- Ensure dependencies are managed
- Demand clarity on ownership and deadlines
- Focus on execution confidence and milestone achievement`,

    EXECUTOR: `ROLE: Execution Assistant
BEHAVIOR:
- Prepare draft documents and tasks
- Generate structured content based on templates
- Always mark outputs as DRAFT requiring approval
- Follow established formats and conventions
- Never commit changes without explicit approval`,

    EDUCATOR: `ROLE: Transformation Educator
BEHAVIOR:
- Teach change management concepts
- Explain SCMS methodology when asked
- Use analogies and examples from industry
- Be patient and thorough in explanations
- Link theory to practical application`
};

// Default Phase Prompts
const DEFAULT_PHASE_PROMPTS = {
    Context: `PHASE: Context (Why Change?)
FOCUS:
- Understanding strategic drivers
- Identifying challenges and pain points
- Mapping stakeholder landscape
- Establishing transformation vision
INSTRUCTION: Be exploratory and questioning. Help surface hidden assumptions.`,

    Assessment: `PHASE: Assessment (Where Are We Now?)
FOCUS:
- Evaluating current state maturity
- Identifying capability gaps
- Prioritizing improvement areas
- Establishing baselines
INSTRUCTION: Be analytical and thorough. Ensure assessments are evidence-based.`,

    Initiatives: `PHASE: Initiatives (What Must Change?)
FOCUS:
- Defining transformation initiatives
- Linking initiatives to gaps and goals
- Estimating effort and impact
- Establishing success criteria
INSTRUCTION: Challenge scope creep. Ensure initiatives are SMART.`,

    Roadmap: `PHASE: Roadmap (When?)
FOCUS:
- Sequencing initiatives into waves
- Managing dependencies and capacity
- Establishing milestones and gates
- Balancing risk and value
INSTRUCTION: Be strict about dependencies. Warn about overcommitment.`,

    Execution: `PHASE: Execution (Delivery & Validation)
FOCUS:
- Tracking task completion
- Managing blockers and escalations
- Monitoring progress against baseline
- Ensuring quality and compliance
INSTRUCTION: Be governance-focused. Demand status updates and accountability.`,

    Stabilization: `PHASE: Stabilization (Sustainment & ROI)
FOCUS:
- Measuring value realization
- Documenting lessons learned
- Ensuring knowledge transfer
- Planning handover to operations
INSTRUCTION: Be analytical about outcomes. Focus on long-term sustainability.`
};

// User preference constraints (what CAN be customized)
const ALLOWED_USER_PREFERENCES = {
    tone: ['PROFESSIONAL', 'FRIENDLY', 'EXPERT'],
    responseLength: ['short', 'medium', 'long'],
    educationMode: [true, false],
    language: ['en', 'pl', 'de', 'fr', 'es', 'zh']
};

const AIPromptHierarchy = {
    PROMPT_LAYERS,

    /**
     * Allow dependency injection for testing
     */
    _setDependencies: (newDeps) => {
        Object.assign(deps, newDeps);
    },

    // ==========================================
    // PROMPT BUILDING
    // ==========================================

    /**
     * Build complete prompt by stacking all layers
     */
    buildPrompt: async (context) => {
        const { aiRole, currentPhase, userId, organizationId } = context;

        const layers = [];

        // Layer 1: System (CANNOT BE OVERRIDDEN)
        layers.push({
            layer: PROMPT_LAYERS.SYSTEM,
            content: await AIPromptHierarchy.getSystemPrompt()
        });

        // Layer 2: Role
        if (aiRole) {
            layers.push({
                layer: PROMPT_LAYERS.ROLE,
                content: await AIPromptHierarchy.getRolePrompt(aiRole)
            });
        }

        // Layer 3: Phase
        if (currentPhase) {
            layers.push({
                layer: PROMPT_LAYERS.PHASE,
                content: await AIPromptHierarchy.getPhasePrompt(currentPhase)
            });
        }

        // Layer 4: User Overlay (filtered)
        if (userId) {
            const userOverlay = await AIPromptHierarchy.getUserOverlay(userId);
            if (userOverlay) {
                layers.push({
                    layer: PROMPT_LAYERS.USER,
                    content: userOverlay
                });
            }
        }

        return AIPromptHierarchy.stackPrompts(layers);
    },

    /**
     * Stack prompts deterministically with conflict resolution
     */
    stackPrompts: (layers) => {
        // Sort by priority (lower number = higher priority)
        layers.sort((a, b) => a.layer - b.layer);

        // Combine with clear section markers
        const sections = layers.map(l => {
            const layerName = Object.keys(PROMPT_LAYERS).find(k => PROMPT_LAYERS[k] === l.layer);
            return `### ${layerName} LAYER ###\n${l.content}`;
        });

        return sections.join('\n\n');
    },

    // ==========================================
    // LAYER RETRIEVAL
    // ==========================================

    /**
     * Get system prompt (checks DB first, falls back to default)
     */
    getSystemPrompt: async () => {
        return new Promise((resolve) => {
            deps.db.get(`
                SELECT content FROM ai_system_prompts 
                WHERE prompt_type = 'system' AND prompt_key = 'GLOBAL' AND is_active = 1
                ORDER BY version DESC LIMIT 1
            `, [], (err, row) => {
                resolve(row?.content || DEFAULT_SYSTEM_PROMPT);
            });
        });
    },

    /**
     * Get role prompt
     */
    getRolePrompt: async (roleKey) => {
        return new Promise((resolve) => {
            deps.db.get(`
                SELECT content FROM ai_system_prompts 
                WHERE prompt_type = 'role' AND prompt_key = ? AND is_active = 1
                ORDER BY version DESC LIMIT 1
            `, [roleKey], (err, row) => {
                resolve(row?.content || DEFAULT_ROLE_PROMPTS[roleKey] || DEFAULT_ROLE_PROMPTS.ADVISOR);
            });
        });
    },

    /**
     * Get phase prompt
     */
    getPhasePrompt: async (phaseKey) => {
        return new Promise((resolve) => {
            deps.db.get(`
                SELECT content FROM ai_system_prompts 
                WHERE prompt_type = 'phase' AND prompt_key = ? AND is_active = 1
                ORDER BY version DESC LIMIT 1
            `, [phaseKey], (err, row) => {
                resolve(row?.content || DEFAULT_PHASE_PROMPTS[phaseKey] || '');
            });
        });
    },

    /**
     * Get user overlay (filtered for safety)
     */
    getUserOverlay: async (userId) => {
        return new Promise((resolve) => {
            deps.db.get(`
                SELECT * FROM ai_user_prompt_prefs WHERE user_id = ?
            `, [userId], (err, row) => {
                if (!row) {
                    resolve(null);
                    return;
                }

                // Build filtered overlay
                const parts = [];

                // Tone (validated)
                if (row.preferred_tone && ALLOWED_USER_PREFERENCES.tone.includes(row.preferred_tone)) {
                    const toneInstructions = {
                        PROFESSIONAL: 'Use formal, structured language.',
                        FRIENDLY: 'Be conversational while remaining professional.',
                        EXPERT: 'Use technical terminology appropriate for domain experts.'
                    };
                    parts.push(`TONE: ${toneInstructions[row.preferred_tone]}`);
                }

                // Response length
                if (row.max_response_length && ALLOWED_USER_PREFERENCES.responseLength.includes(row.max_response_length)) {
                    const lengthInstructions = {
                        short: 'Keep responses concise (under 200 words).',
                        medium: 'Provide balanced responses (200-500 words).',
                        long: 'Provide comprehensive responses when needed.'
                    };
                    parts.push(`LENGTH: ${lengthInstructions[row.max_response_length]}`);
                }

                // Education mode
                if (row.education_mode) {
                    parts.push('EDUCATION MODE: Explain concepts in detail. Include methodology references.');
                }

                // Language
                if (row.language_preference && row.language_preference !== 'en') {
                    parts.push(`LANGUAGE: Respond in ${row.language_preference.toUpperCase()} when appropriate.`);
                }

                // Custom instructions (SANITIZED - no override keywords allowed)
                if (row.custom_instructions) {
                    const sanitized = AIPromptHierarchy._sanitizeCustomInstructions(row.custom_instructions);
                    if (sanitized) {
                        parts.push(`USER NOTES: ${sanitized}`);
                    }
                }

                resolve(parts.length > 0 ? parts.join('\n') : null);
            });
        });
    },

    /**
     * Sanitize custom instructions to prevent prompt injection
     */
    _sanitizeCustomInstructions: (instructions) => {
        if (!instructions) return null;

        // Blocked patterns that could override system behavior
        const blockedPatterns = [
            /ignore previous/gi,
            /ignore all/gi,
            /disregard/gi,
            /forget everything/gi,
            /you are now/gi,
            /pretend to be/gi,
            /act as if/gi,
            /override/gi,
            /bypass/gi,
            /system prompt/gi,
            /jailbreak/gi,
            /dan mode/gi
        ];

        let sanitized = instructions;
        for (const pattern of blockedPatterns) {
            sanitized = sanitized.replace(pattern, '[BLOCKED]');
        }

        // Limit length
        if (sanitized.length > 500) {
            sanitized = sanitized.substring(0, 500) + '...';
        }

        return sanitized;
    },

    // ==========================================
    // PROMPT MANAGEMENT (Admin)
    // ==========================================

    /**
     * Create or update a prompt (creates new version)
     */
    upsertPrompt: async (promptType, promptKey, content, createdBy) => {
        // Get current max version
        const currentVersion = await new Promise((resolve) => {
            deps.db.get(`
                SELECT MAX(version) as max_version FROM ai_system_prompts
                WHERE prompt_type = ? AND prompt_key = ?
            `, [promptType, promptKey], (err, row) => {
                resolve(row?.max_version || 0);
            });
        });

        const newVersion = currentVersion + 1;
        const id = deps.uuidv4();

        return new Promise((resolve, reject) => {
            deps.db.serialize(() => {
                // Deactivate previous versions
                deps.db.run(`
                    UPDATE ai_system_prompts SET is_active = 0
                    WHERE prompt_type = ? AND prompt_key = ?
                `, [promptType, promptKey]);

                // Insert new version
                deps.db.run(`
                    INSERT INTO ai_system_prompts 
                    (id, prompt_type, prompt_key, content, version, is_active, created_by)
                    VALUES (?, ?, ?, ?, ?, 1, ?)
                `, [id, promptType, promptKey, content, newVersion, createdBy], function (err) {
                    if (err) reject(err);
                    else resolve({ id, promptType, promptKey, version: newVersion });
                });
            });
        });
    },

    /**
     * Get all prompts with version history
     */
    getAllPrompts: async (includeInactive = false) => {
        return new Promise((resolve, reject) => {
            const sql = includeInactive
                ? `SELECT * FROM ai_system_prompts ORDER BY prompt_type, prompt_key, version DESC`
                : `SELECT * FROM ai_system_prompts WHERE is_active = 1 ORDER BY prompt_type, prompt_key`;

            deps.db.all(sql, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

    /**
     * Rollback to a specific version
     */
    rollbackToVersion: async (promptType, promptKey, version) => {
        return new Promise((resolve, reject) => {
            deps.db.serialize(() => {
                // Deactivate all versions
                deps.db.run(`
                    UPDATE ai_system_prompts SET is_active = 0
                    WHERE prompt_type = ? AND prompt_key = ?
                `, [promptType, promptKey]);

                // Activate specified version
                deps.db.run(`
                    UPDATE ai_system_prompts SET is_active = 1
                    WHERE prompt_type = ? AND prompt_key = ? AND version = ?
                `, [promptType, promptKey, version], function (err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                });
            });
        });
    },

    // ==========================================
    // USER PREFERENCES
    // ==========================================

    /**
     * Get user prompt preferences
     */
    getUserPreferences: async (userId) => {
        return new Promise((resolve, reject) => {
            deps.db.get(`SELECT * FROM ai_user_prompt_prefs WHERE user_id = ?`, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    },

    /**
     * Update user prompt preferences
     */
    updateUserPreferences: async (userId, preferences) => {
        const { tone, educationMode, language, responseLength, customInstructions } = preferences;

        // Validate inputs
        if (tone && !ALLOWED_USER_PREFERENCES.tone.includes(tone)) {
            throw new Error(`Invalid tone: ${tone}`);
        }
        if (responseLength && !ALLOWED_USER_PREFERENCES.responseLength.includes(responseLength)) {
            throw new Error(`Invalid response length: ${responseLength}`);
        }

        return new Promise((resolve, reject) => {
            deps.db.run(`
                INSERT INTO ai_user_prompt_prefs 
                (user_id, preferred_tone, education_mode, language_preference, max_response_length, custom_instructions)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    preferred_tone = COALESCE(?, preferred_tone),
                    education_mode = COALESCE(?, education_mode),
                    language_preference = COALESCE(?, language_preference),
                    max_response_length = COALESCE(?, max_response_length),
                    custom_instructions = COALESCE(?, custom_instructions),
                    updated_at = CURRENT_TIMESTAMP
            `, [
                userId, tone, educationMode ? 1 : 0, language, responseLength, customInstructions,
                tone, educationMode !== undefined ? (educationMode ? 1 : 0) : null, language, responseLength, customInstructions
            ], function (err) {
                if (err) reject(err);
                else resolve({ userId, updated: true });
            });
        });
    },

    // ==========================================
    // SEED DEFAULT PROMPTS
    // ==========================================

    /**
     * Seed default prompts if not exist
     */
    seedDefaults: async () => {
        // Check if prompts exist
        const existing = await new Promise((resolve) => {
            deps.db.get(`SELECT COUNT(*) as count FROM ai_system_prompts`, [], (err, row) => {
                resolve(row?.count || 0);
            });
        });

        if (existing > 0) {
            return { seeded: false, message: 'Prompts already exist' };
        }

        // Seed system prompt
        await AIPromptHierarchy.upsertPrompt('system', 'GLOBAL', DEFAULT_SYSTEM_PROMPT, 'system');

        // Seed role prompts
        for (const [role, content] of Object.entries(DEFAULT_ROLE_PROMPTS)) {
            await AIPromptHierarchy.upsertPrompt('role', role, content, 'system');
        }

        // Seed phase prompts
        for (const [phase, content] of Object.entries(DEFAULT_PHASE_PROMPTS)) {
            await AIPromptHierarchy.upsertPrompt('phase', phase, content, 'system');
        }

        return { seeded: true, message: 'Default prompts seeded' };
    }
};

module.exports = AIPromptHierarchy;
