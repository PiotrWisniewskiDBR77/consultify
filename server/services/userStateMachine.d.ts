export namespace USER_STATES {
    let ANON: string;
    let DEMO_SESSION: string;
    let TRIAL_TRUSTED: string;
    let ORG_CREATOR: string;
    let ORG_MEMBER: string;
    let TEAM_COLLAB: string;
    let ECOSYSTEM_NODE: string;
}
export namespace PHASES {
    let A: string;
    let B: string;
    let C: string;
    let D: string;
    let E: string;
    let F: string;
    let G: string;
}
export const STATE_TO_PHASE: {
    [USER_STATES.ANON]: string;
    [USER_STATES.DEMO_SESSION]: string;
    [USER_STATES.TRIAL_TRUSTED]: string;
    [USER_STATES.ORG_CREATOR]: string;
    [USER_STATES.ORG_MEMBER]: string;
    [USER_STATES.TEAM_COLLAB]: string;
    [USER_STATES.ECOSYSTEM_NODE]: string;
};
export const VALID_TRANSITIONS: {
    [USER_STATES.ANON]: string[];
    [USER_STATES.DEMO_SESSION]: string[];
    [USER_STATES.TRIAL_TRUSTED]: string[];
    [USER_STATES.ORG_CREATOR]: string[];
    [USER_STATES.ORG_MEMBER]: string[];
    [USER_STATES.TEAM_COLLAB]: string[];
    [USER_STATES.ECOSYSTEM_NODE]: never[];
};
export const STATE_PERMISSIONS: {
    [USER_STATES.ANON]: {
        canViewPublicNarrative: boolean;
        canSeeCategoryFraming: boolean;
        canInteract: boolean;
        canInputData: boolean;
        canUseAI: boolean;
        canPersonalize: boolean;
    };
    [USER_STATES.DEMO_SESSION]: {
        canViewPublicNarrative: boolean;
        canSeeCategoryFraming: boolean;
        canInteract: boolean;
        canInputData: boolean;
        canUseAI: boolean;
        canPersonalize: boolean;
        canAccessReferenceData: boolean;
        hasSessionContext: boolean;
    };
    [USER_STATES.TRIAL_TRUSTED]: {
        canInteract: boolean;
        canInputData: boolean;
        canUseAI: boolean;
        canCreateOrg: boolean;
        canAccessFullSystem: boolean;
        canUseTeamFeatures: boolean;
        canUseBenchmarks: boolean;
    };
    [USER_STATES.ORG_CREATOR]: {
        canInteract: boolean;
        canInputData: boolean;
        canUseAI: boolean;
        canCreateOrg: boolean;
        canDefineRole: boolean;
        canDelegate: boolean;
        canUseBenchmarks: boolean;
    };
    [USER_STATES.ORG_MEMBER]: {
        canInteract: boolean;
        canInputData: boolean;
        canUseAI: boolean;
        canWorkOnDRD: boolean;
        canStoreData: boolean;
        hasPersistentMemory: boolean;
    };
    [USER_STATES.TEAM_COLLAB]: {
        canInteract: boolean;
        canInputData: boolean;
        canUseAI: boolean;
        canInviteUsers: boolean;
        canComment: boolean;
        canDiscuss: boolean;
        canCoCreateAxes: boolean;
    };
    [USER_STATES.ECOSYSTEM_NODE]: {
        canInteract: boolean;
        canInputData: boolean;
        canUseAI: boolean;
        canUseBenchmarks: boolean;
        canUseReferrals: boolean;
        canUseConsultantMode: boolean;
        canReceiveAIReviews: boolean;
        canWorkOnDRD: boolean;
    };
};
export default UserStateMachine;
declare namespace UserStateMachine {
    export { USER_STATES };
    export { PHASES };
    export { STATE_TO_PHASE };
    export { VALID_TRANSITIONS };
    /**
     * Check if a transition is valid
     * @param {string} fromState
     * @param {string} toState
     * @returns {boolean}
     */
    export function canTransition(fromState: string, toState: string): boolean;
    /**
     * Validate transition with context
     * @param {string} fromState
     * @param {string} toState
     * @param {object} context
     * @returns {{ valid: boolean, reason?: string }}
     */
    export function validateTransition(fromState: string, toState: string, context?: object): {
        valid: boolean;
        reason?: string;
    };
    /**
     * Get permissions for a state
     * @param {string} state
     * @returns {object}
     */
    export function getPermissions(state: string): object;
    /**
     * Check if user has specific permission in their state
     * @param {string} state
     * @param {string} permission
     * @returns {boolean}
     */
    export function hasPermission(state: string, permission: string): boolean;
    /**
     * Get the phase for a given state
     * @param {string} state
     * @returns {string}
     */
    export function getPhase(state: string): string;
    /**
     * Get allowed transitions from current state
     * @param {string} currentState
     * @returns {string[]}
     */
    export function getAllowedTransitions(currentState: string): string[];
    /**
     * Alias for getAllowedTransitions
     * @param {string} currentState
     * @returns {string[]}
     */
    export function getNextStates(currentState: string): string[];
    /**
     * Check if state is valid
     * @param {string} state
     * @returns {boolean}
     */
    export function isValidState(state: string): boolean;
    /**
     * Check if phase is valid
     * @param {string} phase
     * @returns {boolean}
     */
    export function isValidPhase(phase: string): boolean;
    /**
     * Check if state is terminal (no outgoing transitions)
     * @param {string} state
     * @returns {boolean}
     */
    export function isTerminalState(state: string): boolean;
}
//# sourceMappingURL=userStateMachine.d.ts.map