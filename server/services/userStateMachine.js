/**
 * User State Machine
 * 
 * Implements the canonical UserState Machine per 01_USER_STATE_MACHINE.md
 * 
 * States: ANON → DEMO_SESSION → TRIAL_TRUSTED → ORG_CREATOR → ORG_MEMBER → TEAM_COLLAB → ECOSYSTEM_NODE
 * 
 * Rules:
 * - States are mutually exclusive
 * - Transitions are explicit
 * - No implicit upgrades allowed
 */

const USER_STATES = {
    ANON: 'ANON',
    DEMO_SESSION: 'DEMO_SESSION',
    TRIAL_TRUSTED: 'TRIAL_TRUSTED',
    ORG_CREATOR: 'ORG_CREATOR',
    ORG_MEMBER: 'ORG_MEMBER',
    TEAM_COLLAB: 'TEAM_COLLAB',
    ECOSYSTEM_NODE: 'ECOSYSTEM_NODE'
};

const PHASES = {
    A: 'A', // PRE-ENTRY
    B: 'B', // DEMO SESSION
    C: 'C', // TRIAL ENTRY
    D: 'D', // ORG SETUP
    E: 'E', // GUIDED FIRST VALUE
    F: 'F', // TEAM EXPANSION
    G: 'G'  // ECOSYSTEM
};

// State → Phase mapping (canonical)
const STATE_TO_PHASE = {
    [USER_STATES.ANON]: PHASES.A,
    [USER_STATES.DEMO_SESSION]: PHASES.B,
    [USER_STATES.TRIAL_TRUSTED]: PHASES.C,
    [USER_STATES.ORG_CREATOR]: PHASES.D,
    [USER_STATES.ORG_MEMBER]: PHASES.E,
    [USER_STATES.TEAM_COLLAB]: PHASES.F,
    [USER_STATES.ECOSYSTEM_NODE]: PHASES.G
};

// Valid transitions per 01_USER_STATE_MACHINE.md
const VALID_TRANSITIONS = {
    [USER_STATES.ANON]: [USER_STATES.DEMO_SESSION],
    [USER_STATES.DEMO_SESSION]: [USER_STATES.TRIAL_TRUSTED, USER_STATES.ANON],
    [USER_STATES.TRIAL_TRUSTED]: [USER_STATES.ORG_CREATOR],
    [USER_STATES.ORG_CREATOR]: [USER_STATES.ORG_MEMBER],
    [USER_STATES.ORG_MEMBER]: [USER_STATES.TEAM_COLLAB],
    [USER_STATES.TEAM_COLLAB]: [USER_STATES.ECOSYSTEM_NODE],
    [USER_STATES.ECOSYSTEM_NODE]: [] // Terminal state (can only expand)
};

// State permissions per documentation
const STATE_PERMISSIONS = {
    [USER_STATES.ANON]: {
        canViewPublicNarrative: true,
        canSeeCategoryFraming: true,
        canInteract: false,
        canInputData: false,
        canUseAI: false,
        canPersonalize: false
    },
    [USER_STATES.DEMO_SESSION]: {
        canViewPublicNarrative: true,
        canSeeCategoryFraming: true,
        canInteract: true,
        canInputData: false, // read-only
        canUseAI: true, // narrator mode only
        canPersonalize: false,
        canAccessReferenceData: true,
        hasSessionContext: true
    },
    [USER_STATES.TRIAL_TRUSTED]: {
        canInteract: true,
        canInputData: true, // limited
        canUseAI: true, // guide mode
        canCreateOrg: false, // not yet
        canAccessFullSystem: false,
        canUseTeamFeatures: false,
        canUseBenchmarks: false
    },
    [USER_STATES.ORG_CREATOR]: {
        canInteract: true,
        canInputData: true,
        canUseAI: true,
        canCreateOrg: true,
        canDefineRole: true,
        canDelegate: false,
        canUseBenchmarks: false
    },
    [USER_STATES.ORG_MEMBER]: {
        canInteract: true,
        canInputData: true,
        canUseAI: true, // thinking partner
        canWorkOnDRD: true,
        canStoreData: true,
        hasPersistentMemory: true
    },
    [USER_STATES.TEAM_COLLAB]: {
        canInteract: true,
        canInputData: true,
        canUseAI: true, // facilitator
        canInviteUsers: true,
        canComment: true,
        canDiscuss: true,
        canCoCreateAxes: true
    },
    [USER_STATES.ECOSYSTEM_NODE]: {
        canInteract: true,
        canInputData: true,
        canUseAI: true, // meta-analyst
        canUseBenchmarks: true,
        canUseReferrals: true,
        canUseConsultantMode: true,
        canReceiveAIReviews: true
    }
};

const UserStateMachine = {
    USER_STATES,
    PHASES,
    STATE_TO_PHASE,

    /**
     * Check if a transition is valid
     * @param {string} fromState 
     * @param {string} toState 
     * @returns {boolean}
     */
    canTransition(fromState, toState) {
        const allowed = VALID_TRANSITIONS[fromState] || [];
        return allowed.includes(toState);
    },

    /**
     * Validate transition with context
     * @param {string} fromState 
     * @param {string} toState 
     * @param {object} context 
     * @returns {{ valid: boolean, reason?: string }}
     */
    validateTransition(fromState, toState, context = {}) {
        if (!this.canTransition(fromState, toState)) {
            return {
                valid: false,
                reason: `Invalid transition: ${fromState} → ${toState}. Allowed: ${VALID_TRANSITIONS[fromState]?.join(', ') || 'none'}`
            };
        }

        // ANON → DEMO_SESSION requires login
        if (fromState === USER_STATES.ANON && toState === USER_STATES.DEMO_SESSION) {
            if (!context.isLoggedIn) {
                return { valid: false, reason: 'OAuth or email login required' };
            }
        }

        // DEMO_SESSION → TRIAL_TRUSTED requires access code
        if (fromState === USER_STATES.DEMO_SESSION && toState === USER_STATES.TRIAL_TRUSTED) {
            if (!context.hasAccessCode && !context.hasReferral && !context.hasConsultantInvite && !context.hasTeamInvite) {
                return { valid: false, reason: 'Access code, referral, consultant invite, or team invite required' };
            }
        }

        // TRIAL_TRUSTED → ORG_CREATOR requires explicit decision
        if (fromState === USER_STATES.TRIAL_TRUSTED && toState === USER_STATES.ORG_CREATOR) {
            if (!context.hasExplicitOrgDecision) {
                return { valid: false, reason: 'Explicit decision to create organization required' };
            }
        }

        // ORG_CREATOR → ORG_MEMBER requires org to exist
        if (fromState === USER_STATES.ORG_CREATOR && toState === USER_STATES.ORG_MEMBER) {
            if (!context.organizationId) {
                return { valid: false, reason: 'Organization must be created first' };
            }
        }

        // TEAM_COLLAB → ECOSYSTEM_NODE requires method advocacy or organization success
        if (fromState === USER_STATES.TEAM_COLLAB && toState === USER_STATES.ECOSYSTEM_NODE) {
            if (!context.hasMethodAdvocacy && !context.hasOrganizationSuccess) {
                return { valid: false, reason: 'Method advocacy or organization success required for Ecosystem transition' };
            }
        }

        return { valid: true };
    },

    /**
     * Get permissions for a state
     * @param {string} state 
     * @returns {object}
     */
    getPermissions(state) {
        return STATE_PERMISSIONS[state] || {};
    },

    /**
     * Check if user has specific permission in their state
     * @param {string} state 
     * @param {string} permission 
     * @returns {boolean}
     */
    hasPermission(state, permission) {
        const perms = this.getPermissions(state);
        return perms[permission] === true;
    },

    /**
     * Get the phase for a given state
     * @param {string} state 
     * @returns {string}
     */
    getPhase(state) {
        return STATE_TO_PHASE[state] || PHASES.A;
    },

    /**
     * Get allowed transitions from current state
     * @param {string} currentState 
     * @returns {string[]}
     */
    getAllowedTransitions(currentState) {
        return VALID_TRANSITIONS[currentState] || [];
    },

    /**
     * Check if state is valid
     * @param {string} state 
     * @returns {boolean}
     */
    isValidState(state) {
        return Object.values(USER_STATES).includes(state);
    },

    /**
     * Check if phase is valid
     * @param {string} phase 
     * @returns {boolean}
     */
    isValidPhase(phase) {
        return Object.values(PHASES).includes(phase);
    }
};

module.exports = UserStateMachine;
