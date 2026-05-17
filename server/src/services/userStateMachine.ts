/**
 * User State Machine
 *
 * Canonical state/phase rules used by userStateGuard middleware.
 * Kept intentionally deterministic and side-effect free.
 */

const USER_STATES = {
  ANON: 'ANON',
  DEMO_SESSION: 'DEMO_SESSION',
  TRIAL_ENTRY: 'TRIAL_ENTRY',
  TRIAL_TRUSTED: 'TRIAL_TRUSTED',
  ORG_CREATOR: 'ORG_CREATOR',
  ORG_MEMBER: 'ORG_MEMBER',
  TEAM_COLLAB: 'TEAM_COLLAB',
  ECOSYSTEM_NODE: 'ECOSYSTEM_NODE',
} as const;

const PHASES = {
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
} as const;

type UserState = (typeof USER_STATES)[keyof typeof USER_STATES];

const STATE_PHASE: Record<UserState, string> = {
  [USER_STATES.ANON]: PHASES.A,
  [USER_STATES.DEMO_SESSION]: PHASES.B,
  [USER_STATES.TRIAL_ENTRY]: PHASES.B,
  [USER_STATES.TRIAL_TRUSTED]: PHASES.C,
  [USER_STATES.ORG_CREATOR]: PHASES.C,
  [USER_STATES.ORG_MEMBER]: PHASES.C,
  [USER_STATES.TEAM_COLLAB]: PHASES.D,
  [USER_STATES.ECOSYSTEM_NODE]: PHASES.D,
};

const STATE_PERMISSIONS: Record<UserState, Record<string, boolean>> = {
  [USER_STATES.ANON]: {
    canViewPublicNarrative: true,
    canInteract: false,
    canInputData: false,
    canUseAI: false,
  },
  [USER_STATES.DEMO_SESSION]: {
    canViewPublicNarrative: true,
    canInteract: true,
    canInputData: false,
    canUseAI: true,
    hasSessionContext: true,
  },
  [USER_STATES.TRIAL_ENTRY]: {
    canViewPublicNarrative: true,
    canInteract: true,
    canInputData: false,
    canUseAI: true,
    hasSessionContext: false,
  },
  [USER_STATES.TRIAL_TRUSTED]: {
    canViewPublicNarrative: true,
    canInteract: true,
    canInputData: true,
    canUseAI: true,
  },
  [USER_STATES.ORG_CREATOR]: {
    canViewPublicNarrative: true,
    canInteract: true,
    canInputData: true,
    canUseAI: true,
    canCreateOrg: true,
    canDefineRole: true,
    canDelegate: false,
  },
  [USER_STATES.ORG_MEMBER]: {
    canViewPublicNarrative: true,
    canInteract: true,
    canInputData: true,
    canUseAI: true,
    canCollaborate: true,
  },
  [USER_STATES.TEAM_COLLAB]: {
    canViewPublicNarrative: true,
    canInteract: true,
    canInputData: true,
    canUseAI: true,
    canCollaborate: true,
    canDelegate: true,
  },
  [USER_STATES.ECOSYSTEM_NODE]: {
    canViewPublicNarrative: true,
    canInteract: true,
    canInputData: true,
    canUseAI: true,
    canWorkOnDRD: true,
    canCollaborate: true,
    canDelegate: true,
  },
};

const VALID_TRANSITIONS: Record<UserState, UserState[]> = {
  [USER_STATES.ANON]: [USER_STATES.DEMO_SESSION, USER_STATES.TRIAL_ENTRY],
  [USER_STATES.DEMO_SESSION]: [USER_STATES.TRIAL_TRUSTED, USER_STATES.ORG_CREATOR],
  [USER_STATES.TRIAL_ENTRY]: [USER_STATES.TRIAL_TRUSTED, USER_STATES.ORG_CREATOR],
  [USER_STATES.TRIAL_TRUSTED]: [USER_STATES.ORG_CREATOR, USER_STATES.ORG_MEMBER],
  [USER_STATES.ORG_CREATOR]: [USER_STATES.ORG_MEMBER, USER_STATES.TEAM_COLLAB],
  [USER_STATES.ORG_MEMBER]: [USER_STATES.TEAM_COLLAB, USER_STATES.ECOSYSTEM_NODE],
  [USER_STATES.TEAM_COLLAB]: [USER_STATES.ECOSYSTEM_NODE],
  [USER_STATES.ECOSYSTEM_NODE]: [],
};

const canTransition = (fromState: string, toState: string): boolean => {
  const allowed = VALID_TRANSITIONS[fromState as UserState] || [];
  return allowed.includes(toState as UserState) && fromState !== toState;
};

const validateTransition = (
  fromState: string,
  toState: string
): { valid: boolean; reason?: string } => {
  if (!canTransition(fromState, toState)) {
    return {
      valid: false,
      reason: `Cannot transition from ${fromState} to ${toState}`,
    };
  }
  return { valid: true };
};

const getPermissions = (state: string): Record<string, unknown> => {
  return STATE_PERMISSIONS[state as UserState] || STATE_PERMISSIONS[USER_STATES.ANON];
};

const hasPermission = (state: string, permission: string): boolean => {
  const permissions = getPermissions(state) as Record<string, unknown>;
  return permissions[permission] === true;
};

const getPhase = (state: string): string => {
  return STATE_PHASE[state as UserState] || PHASES.A;
};

const getNextStates = (state: string): string[] => {
  return VALID_TRANSITIONS[state as UserState] || [];
};

const isTerminalState = (state: string): boolean => getNextStates(state).length === 0;

const UserStateMachine = {
  USER_STATES,
  PHASES,
  VALID_TRANSITIONS,
  canTransition,
  validateTransition,
  getPermissions,
  hasPermission,
  getPhase,
  getNextStates,
  isTerminalState,
};

export {
  canTransition,
  getNextStates,
  getPermissions,
  getPhase,
  hasPermission,
  isTerminalState,
  PHASES,
  USER_STATES,
  VALID_TRANSITIONS,
  validateTransition,
};

export default UserStateMachine;
