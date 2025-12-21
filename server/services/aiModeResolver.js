/**
 * AI Mode Resolver
 * 
 * Maps Phase + UserState to AI Mode per:
 * - 02_AI_BEHAVIOR_BY_PHASE.md
 * - 30_AI_MODE_SWITCHING.md
 * 
 * AI Modes:
 * - OFF: No AI presence
 * - NARRATOR: Explains system, no recommendations
 * - GUIDE: Cautious, validates seriousness
 * - THINKING_PARTNER: Full method guardian
 * - FACILITATOR: Mediates team discussions
 * - META_ANALYST: Pattern recognition, benchmarks
 */

const UserStateMachine = require('./userStateMachine');

const AI_MODES = {
    OFF: 'OFF',
    NARRATOR: 'NARRATOR',
    GUIDE: 'GUIDE',
    THINKING_PARTNER: 'THINKING_PARTNER',
    FACILITATOR: 'FACILITATOR',
    META_ANALYST: 'META_ANALYST'
};

// Phase → AI Mode mapping per documentation
const PHASE_TO_MODE = {
    A: AI_MODES.OFF,              // PRE-ENTRY: No AI presence
    B: AI_MODES.NARRATOR,         // DEMO SESSION: Narrator, explainer
    C: AI_MODES.GUIDE,            // TRIAL ENTRY: Cautious guide
    D: AI_MODES.GUIDE,            // ORG SETUP: Context architect (uses GUIDE mode)
    E: AI_MODES.THINKING_PARTNER, // FIRST VALUE: Thinking partner
    F: AI_MODES.FACILITATOR,      // TEAM EXPANSION: Facilitator
    G: AI_MODES.META_ANALYST      // ECOSYSTEM: Meta-analyst
};

// Mode capabilities (what AI is allowed to do)
const MODE_CAPABILITIES = {
    [AI_MODES.OFF]: {
        canRespond: false,
        canExplain: false,
        canRecommend: false,
        canAnalyze: false,
        canFacilitate: false,
        canBenchmark: false,
        allowedActions: []
    },
    [AI_MODES.NARRATOR]: {
        canRespond: true,
        canExplain: true,
        canRecommend: false,  // FORBIDDEN
        canAnalyze: false,    // FORBIDDEN
        canFacilitate: false,
        canBenchmark: false,
        allowedActions: ['explain_system', 'explain_drd', 'explain_limitations'],
        forbiddenActions: ['recommend', 'optimize', 'request_data'],
        tone: 'Calm. Precise. Non-promotional.'
    },
    [AI_MODES.GUIDE]: {
        canRespond: true,
        canExplain: true,
        canRecommend: false,  // Not yet
        canAnalyze: false,
        canFacilitate: false,
        canBenchmark: false,
        allowedActions: ['explain_consequences', 'confirm_readiness', 'explain_org_importance'],
        forbiddenActions: ['automate', 'shortcut', 'delegate', 'propose_solutions', 'jump_ahead'],
        tone: 'Cautious. Validating seriousness.'
    },
    [AI_MODES.THINKING_PARTNER]: {
        canRespond: true,
        canExplain: true,
        canRecommend: true,
        canAnalyze: true,
        canFacilitate: false,
        canBenchmark: false,
        allowedActions: ['suggest_axes', 'set_sequence', 'explain_logic', 'ask_questions', 'provide_insight'],
        rules: ['max 5-7 questions', 'one axis at a time', 'explain WHY each question exists'],
        successCondition: 'User expresses clarity and understanding'
    },
    [AI_MODES.FACILITATOR]: {
        canRespond: true,
        canExplain: true,
        canRecommend: true,
        canAnalyze: true,
        canFacilitate: true,
        canBenchmark: false,
        allowedActions: ['highlight_differences', 'synthesize_views', 'mediate_conflict'],
        forbiddenActions: ['take_sides'],
        tone: 'Neutral. Synthesizing.'
    },
    [AI_MODES.META_ANALYST]: {
        canRespond: true,
        canExplain: true,
        canRecommend: true,
        canAnalyze: true,
        canFacilitate: true,
        canBenchmark: true,
        allowedActions: ['pattern_recognition', 'anonymized_comparisons', 'benchmark_interpretation'],
        forbiddenActions: ['expose_identities', 'prescriptive_authority'],
        tone: 'Analytical. Pattern-focused.'
    }
};

// System prompts per mode (injected into AI calls)
const MODE_SYSTEM_INSTRUCTIONS = {
    [AI_MODES.OFF]: null, // No AI

    [AI_MODES.NARRATOR]: `
CURRENT_MODE: NARRATOR

You are in NARRATOR mode. Your role is to explain and educate, NOT to recommend or analyze.

ALLOWED:
- Explain how the system works
- Explain the DRD methodology philosophy
- Explain the system's limitations and constraints

FORBIDDEN:
- Making recommendations
- Suggesting optimizations
- Requesting user data
- Proposing solutions

TONE: Calm. Precise. Non-promotional. No hype. No promises.

If the user asks for recommendations, respond:
"In this phase, I'm here to explain how the system works. Once you're ready to work on your own context, I can help you think through decisions."
`,

    [AI_MODES.GUIDE]: `
CURRENT_MODE: GUIDE

You are in GUIDE mode. Your role is to validate readiness and explain consequences.

ALLOWED:
- Explain the consequences of creating an organization
- Confirm the user's readiness to commit time
- Explain why each step matters

FORBIDDEN:
- Automating decisions
- Providing shortcuts
- Delegating tasks
- Proposing specific solutions
- Jumping ahead to later phases

TONE: Cautious. Serious. Respectful of the user's time.

If the user asks to skip steps, respond:
"This system is designed to help you think carefully. Each step exists for a reason. Are you ready to invest the time to do this properly?"
`,

    [AI_MODES.THINKING_PARTNER]: `
CURRENT_MODE: THINKING_PARTNER

You are in THINKING_PARTNER mode. Your role is to guide structured thinking through the DRD method.

RULES:
- Ask maximum 5-7 questions per session
- Focus on one axis at a time
- Always explain WHY each question exists
- Suggest DRD axes based on context
- Set the sequence intentionally

SUCCESS CONDITION: The user expresses clarity and understanding.

APPROACH:
- Be a thinking partner, not an answer machine
- Question assumptions
- Highlight blind spots
- Provide structured frameworks

OUTCOME TARGET: DRD snapshot, first insight, sense of clarity.
`,

    [AI_MODES.FACILITATOR]: `
CURRENT_MODE: FACILITATOR

You are in FACILITATOR mode. Your role is to help multiple perspectives work together.

ALLOWED:
- Highlight differences between viewpoints
- Synthesize views into coherent frameworks
- Mediate conflicts constructively

FORBIDDEN:
- Taking sides
- Favoring one perspective over another
- Making final decisions

TONE: Neutral. Constructive. Synthesis-focused.

When perspectives conflict, respond:
"I see different perspectives here. Let me summarize each viewpoint and explore where they might complement each other."
`,

    [AI_MODES.META_ANALYST]: `
CURRENT_MODE: META_ANALYST

You are in META_ANALYST mode. Your role is ecosystem-level intelligence.

ALLOWED:
- Pattern recognition across anonymized data
- Benchmark interpretation
- Anonymized comparisons

FORBIDDEN:
- Exposing organizational identities
- Prescriptive authority (final decisions are human)

TONE: Analytical. Data-driven. Pattern-focused.

All comparisons must be anonymized. Never reveal specific organization details.
`
};

const AIModeResolver = {
    AI_MODES,
    PHASE_TO_MODE,
    MODE_CAPABILITIES,

    /**
     * Get AI mode for current phase
     * @param {string} phase - Current phase (A-G)
     * @returns {string} AI mode
     */
    getModeForPhase(phase) {
        return PHASE_TO_MODE[phase] || AI_MODES.OFF;
    },

    /**
     * Get AI mode for current user state
     * @param {string} userState 
     * @returns {string} AI mode
     */
    getModeForState(userState) {
        const phase = UserStateMachine.getPhase(userState);
        return this.getModeForPhase(phase);
    },

    /**
     * Get capabilities for a mode
     * @param {string} mode 
     * @returns {object}
     */
    getCapabilities(mode) {
        return MODE_CAPABILITIES[mode] || MODE_CAPABILITIES[AI_MODES.OFF];
    },

    /**
     * Check if action is allowed in mode
     * @param {string} mode 
     * @param {string} action 
     * @returns {boolean}
     */
    isActionAllowed(mode, action) {
        const caps = this.getCapabilities(mode);

        // Check forbidden first
        if (caps.forbiddenActions?.includes(action)) {
            return false;
        }

        // Check allowed
        if (caps.allowedActions?.includes(action)) {
            return true;
        }

        // Default based on general capabilities
        return true;
    },

    /**
     * Get system instruction for mode
     * @param {string} mode 
     * @returns {string|null}
     */
    getSystemInstruction(mode) {
        return MODE_SYSTEM_INSTRUCTIONS[mode] || null;
    },

    /**
     * Check if AI should respond at all
     * @param {string} mode 
     * @returns {boolean}
     */
    canAIRespond(mode) {
        const caps = this.getCapabilities(mode);
        return caps.canRespond === true;
    },

    /**
     * Get refusal message for OFF mode
     * @returns {string}
     */
    getOffModeResponse() {
        return "I'm not available in this phase. Please proceed to see how the system works first.";
    },

    /**
     * Validate AI request against mode restrictions
     * @param {string} mode 
     * @param {string} requestType - Type of AI request
     * @returns {{ allowed: boolean, reason?: string, alternative?: string }}
     */
    validateRequest(mode, requestType) {
        if (mode === AI_MODES.OFF) {
            return {
                allowed: false,
                reason: 'AI is not available in Phase A (Pre-Entry)',
                alternative: 'Click "See how it works" to enter Demo mode'
            };
        }

        const caps = this.getCapabilities(mode);

        // Map request types to capability checks
        const requestToCapability = {
            'recommend': 'canRecommend',
            'recommendation': 'canRecommend',
            'analyze': 'canAnalyze',
            'analysis': 'canAnalyze',
            'benchmark': 'canBenchmark',
            'compare': 'canBenchmark',
            'facilitate': 'canFacilitate'
        };

        const capability = requestToCapability[requestType.toLowerCase()];
        if (capability && caps[capability] === false) {
            return {
                allowed: false,
                reason: `${requestType} is not available in ${mode} mode`,
                alternative: caps.allowedActions?.join(', ') || 'Limited actions available'
            };
        }

        return { allowed: true };
    }
};

module.exports = AIModeResolver;
