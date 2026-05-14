import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  attachUserState,
  requirePermission,
  requirePhase,
  requireState,
  setDependencies,
  transitionState,
} from '../../../../server/src/middleware/userStateGuard.middleware.ts';

const mockUserStateMachine = {
  USER_STATES: { ANON: 'ANON', ORG_MEMBER: 'ORG_MEMBER', TEAM_COLLAB: 'TEAM_COLLAB' },
  PHASES: { A: 'A', B: 'B' },
  getPermissions: vi.fn(() => ({ canRead: true })),
  hasPermission: vi.fn(() => true),
  validateTransition: vi.fn(() => ({ valid: true })),
  getPhase: vi.fn((state: string) => (state === 'TEAM_COLLAB' ? 'B' : 'A')),
};

const mockDb = {
  getAsync: vi.fn(),
  run: vi.fn(),
};

describe('userStateGuard.middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDependencies({
      UserStateMachine: mockUserStateMachine as any,
      db: mockDb as any,
    });
  });

  it('attachUserState falls back to ANON when user id accessor throws', async () => {
    const req: any = {
      user: {},
    };
    Object.defineProperty(req.user, 'id', {
      configurable: true,
      get: () => {
        throw new Error('id getter failed');
      },
    });
    const res: any = {};
    const next = vi.fn();

    await attachUserState(req, res, next);

    expect(req.userState).toBe('ANON');
    expect(req.currentPhase).toBe('A');
    expect(req.statePermissions).toEqual({ canRead: true });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('attachUserState sets statePermissions on no-user early return path', async () => {
    const req: any = { user: {} };
    const res: any = {};
    const next = vi.fn();

    await attachUserState(req, res, next);

    expect(req.userState).toBe('ANON');
    expect(req.currentPhase).toBe('A');
    expect(req.statePermissions).toEqual({ canRead: true });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('attachUserState sets statePermissions when database dependency is unavailable', async () => {
    setDependencies({
      UserStateMachine: mockUserStateMachine as any,
      db: null as any,
    });
    const req: any = { user: { id: 'u-1' } };
    const res: any = {};
    const next = vi.fn();

    await attachUserState(req, res, next);

    expect(req.userState).toBe('ANON');
    expect(req.currentPhase).toBe('A');
    expect(req.statePermissions).toEqual({ canRead: true });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('attachUserState uses DB state when available', async () => {
    mockDb.getAsync.mockResolvedValue({ user_journey_state: 'ORG_MEMBER', current_phase: 'B' });
    const req: any = { user: { id: 'u-1' } };
    const res: any = {};
    const next = vi.fn();

    await attachUserState(req, res, next);

    expect(req.userState).toBe('ORG_MEMBER');
    expect(req.currentPhase).toBe('B');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('attachUserState falls back to ANON when DB returns non-object row', async () => {
    mockDb.getAsync.mockResolvedValue('ORG_MEMBER');
    const req: any = { user: { id: 'u-1' } };
    const res: any = {};
    const next = vi.fn();

    await attachUserState(req, res, next);

    expect(req.userState).toBe('ANON');
    expect(req.currentPhase).toBe('A');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('attachUserState normalizes whitespace-only DB state values to defaults', async () => {
    mockDb.getAsync.mockResolvedValue({ user_journey_state: '   ', current_phase: '\t\n' });
    const req: any = { user: { id: 'u-1' } };
    const res: any = {};
    const next = vi.fn();

    await attachUserState(req, res, next);

    expect(req.userState).toBe('ANON');
    expect(req.currentPhase).toBe('A');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('attachUserState trims DB state values before assigning', async () => {
    mockDb.getAsync.mockResolvedValue({
      user_journey_state: '  ORG_MEMBER  ',
      current_phase: '  B  ',
    });
    const req: any = { user: { id: 'u-1' } };
    const res: any = {};
    const next = vi.fn();

    await attachUserState(req, res, next);

    expect(req.userState).toBe('ORG_MEMBER');
    expect(req.currentPhase).toBe('B');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('attachUserState falls back to ANON when DB returns unknown user state', async () => {
    mockDb.getAsync.mockResolvedValue({ user_journey_state: 'CORRUPTED', current_phase: 'B' });
    const req: any = { user: { id: 'u-1' } };
    const res: any = {};
    const next = vi.fn();

    await attachUserState(req, res, next);

    expect(req.userState).toBe('ANON');
    expect(req.currentPhase).toBe('B');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('attachUserState repairs unknown phase using state machine phase', async () => {
    mockDb.getAsync.mockResolvedValue({ user_journey_state: 'TEAM_COLLAB', current_phase: 'Z' });
    const req: any = { user: { id: 'u-1' } };
    const res: any = {};
    const next = vi.fn();

    await attachUserState(req, res, next);

    expect(req.userState).toBe('TEAM_COLLAB');
    expect(req.currentPhase).toBe('B');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('attachUserState falls back to default phase when unknown-phase repair getPhase throws', async () => {
    mockDb.getAsync.mockResolvedValue({ user_journey_state: 'TEAM_COLLAB', current_phase: 'Z' });
    mockUserStateMachine.getPhase.mockImplementationOnce(() => {
      throw new Error('phase mapper failed');
    });
    const req: any = { user: { id: 'u-1' } };
    const res: any = {};
    const next = vi.fn();

    await attachUserState(req, res, next);

    expect(req.userState).toBe('TEAM_COLLAB');
    expect(req.currentPhase).toBe('A');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('attachUserState uses ANON permissions fallback when getPermissions throws', async () => {
    mockDb.getAsync.mockResolvedValue({ user_journey_state: 'ORG_MEMBER', current_phase: 'B' });
    mockUserStateMachine.getPermissions
      .mockImplementationOnce(() => {
        throw new Error('permissions boom');
      })
      .mockImplementation(() => ({ fallback: true }));
    const req: any = { user: { id: 'u-1' } };
    const res: any = {};
    const next = vi.fn();

    await attachUserState(req, res, next);

    expect(req.userState).toBe('ORG_MEMBER');
    expect(req.currentPhase).toBe('B');
    expect(req.statePermissions).toEqual({ fallback: true });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('attachUserState coerces undefined permissions into ANON fallback object', async () => {
    mockDb.getAsync.mockResolvedValue({ user_journey_state: 'ORG_MEMBER', current_phase: 'B' });
    mockUserStateMachine.getPermissions
      .mockReturnValueOnce(undefined as any)
      .mockImplementation(() => ({ fallback: true }));
    const req: any = { user: { id: 'u-1' } };
    const res: any = {};
    const next = vi.fn();

    await attachUserState(req, res, next);

    expect(req.statePermissions).toEqual({ fallback: true });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('attachUserState coerces array permissions into ANON fallback object', async () => {
    mockDb.getAsync.mockResolvedValue({ user_journey_state: 'ORG_MEMBER', current_phase: 'B' });
    mockUserStateMachine.getPermissions
      .mockReturnValueOnce(['unexpected'] as any)
      .mockImplementation(() => ({ fallback: true }));
    const req: any = { user: { id: 'u-1' } };
    const res: any = {};
    const next = vi.fn();

    await attachUserState(req, res, next);

    expect(req.statePermissions).toEqual({ fallback: true });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('requireState denies when state is not allowed', () => {
    const middleware = requireState(['TEAM_COLLAB']);
    const req: any = { userState: 'ANON', currentPhase: 'A' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('requireState trims allowed state list entries', () => {
    const middleware = requireState('  ORG_MEMBER  ');
    const req: any = { userState: 'ORG_MEMBER', currentPhase: 'A' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('requireState returns 401 when userState is whitespace-only', () => {
    const middleware = requireState(['ORG_MEMBER']);
    const req: any = { userState: '   \t ', currentPhase: 'A' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'USER_STATE_UNKNOWN',
      message: 'User state not determined. Are you logged in?',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('requireState returns 401 when req.userState accessor throws', () => {
    const middleware = requireState(['ORG_MEMBER']);
    const req: any = {};
    Object.defineProperty(req, 'userState', {
      configurable: true,
      get: () => {
        throw new Error('userState getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'USER_STATE_UNKNOWN',
      message: 'User state not determined. Are you logged in?',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('requirePhase allows when phase is allowed', () => {
    const middleware = requirePhase(['A', 'B']);
    const req: any = { currentPhase: 'B' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('requirePhase trims allowed phase list entries', () => {
    const middleware = requirePhase([' A ', '  B  ']);
    const req: any = { currentPhase: 'B' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('requirePhase returns 401 when current phase is not determined', () => {
    const middleware = requirePhase(['A']);
    const req: any = {};
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'USER_PHASE_UNKNOWN',
      message: 'User phase not determined. Are you logged in?',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('requirePhase returns 401 when req.currentPhase accessor throws', () => {
    const middleware = requirePhase(['A']);
    const req: any = {};
    Object.defineProperty(req, 'currentPhase', {
      configurable: true,
      get: () => {
        throw new Error('currentPhase getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'USER_PHASE_UNKNOWN',
      message: 'User phase not determined. Are you logged in?',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when requirePhase contains unknown phases', () => {
    const middleware = requirePhase(['Z']);
    const req: any = { currentPhase: 'A' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'MISCONFIGURED_USER_STATE_GUARD',
        invalidPhases: ['Z'],
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when requireState is configured with no valid allowed states', () => {
    const middleware = requireState(['', '   ']);
    const req: any = { userState: 'ORG_MEMBER', currentPhase: 'A' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when requireState contains unknown states', () => {
    const middleware = requireState(['ORG_MEBER']);
    const req: any = { userState: 'ORG_MEMBER', currentPhase: 'A' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'MISCONFIGURED_USER_STATE_GUARD',
        invalidStates: ['ORG_MEBER'],
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('requirePermission denies when state machine returns false', () => {
    mockUserStateMachine.hasPermission.mockReturnValue(false);
    const middleware = requirePermission('canWrite');
    const req: any = { userState: 'ANON' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('requirePermission denies when hasPermission throws', () => {
    mockUserStateMachine.hasPermission.mockImplementation(() => {
      throw new Error('machine boom');
    });
    const middleware = requirePermission('canWrite');
    const req: any = { userState: 'ORG_MEMBER' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'PERMISSION_DENIED' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('requirePermission returns 401 when user state is missing', () => {
    const middleware = requirePermission('canWrite');
    const req: any = {};
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'USER_STATE_UNKNOWN',
      message: 'User state not determined. Are you logged in?',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('requirePermission returns 401 when req.userState accessor throws', () => {
    const middleware = requirePermission('canWrite');
    const req: any = {};
    Object.defineProperty(req, 'userState', {
      configurable: true,
      get: () => {
        throw new Error('userState getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'USER_STATE_UNKNOWN',
      message: 'User state not determined. Are you logged in?',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when requirePermission is configured with invalid key', () => {
    const middleware = requirePermission('   ');
    const req: any = { userState: 'ORG_MEMBER' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MISCONFIGURED_USER_STATE_GUARD',
      message: 'requirePermission was configured with no valid permission key.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('transitionState returns error when DB is unavailable', async () => {
    setDependencies({ db: null as any });
    const result = await transitionState('u-1', 'ANON', 'TEAM_COLLAB');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Database not available');
  });

  it('transitionState rejects blank user id without calling DB', async () => {
    mockUserStateMachine.validateTransition.mockReturnValue({ valid: true });
    mockDb.run.mockResolvedValue(undefined);

    const result = await transitionState('   ', 'ANON', 'TEAM_COLLAB');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid user id/i);
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  it('transitionState trims user id before DB update', async () => {
    mockUserStateMachine.validateTransition.mockReturnValue({ valid: true });
    mockDb.run.mockResolvedValue(undefined);

    const result = await transitionState('  u-1  ', 'ANON', 'TEAM_COLLAB');

    expect(result.success).toBe(true);
    expect(mockDb.run).toHaveBeenCalledTimes(1);
    const params = mockDb.run.mock.calls[0][1] as unknown[];
    expect(params[2]).toBe('u-1');
  });

  it('transitionState rejects blank fromState without calling validation or DB', async () => {
    mockUserStateMachine.validateTransition.mockReturnValue({ valid: true });
    mockDb.run.mockResolvedValue(undefined);

    const result = await transitionState('u-1', '   ', 'TEAM_COLLAB');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid state/i);
    expect(mockUserStateMachine.validateTransition).not.toHaveBeenCalled();
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  it('transitionState rejects unknown fromState without validation or DB', async () => {
    const result = await transitionState('u-1', 'INVALID_STATE', 'TEAM_COLLAB');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Unknown user state/i);
    expect(mockUserStateMachine.validateTransition).not.toHaveBeenCalled();
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  it('transitionState rejects unknown toState without validation or DB', async () => {
    const result = await transitionState('u-1', 'ANON', 'INVALID_STATE');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Unknown user state/i);
    expect(mockUserStateMachine.validateTransition).not.toHaveBeenCalled();
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  it('transitionState returns failure when DB update affects zero rows', async () => {
    mockUserStateMachine.validateTransition.mockReturnValue({ valid: true });
    mockDb.run.mockResolvedValue({ changes: 0 });

    const result = await transitionState('u-missing', 'ANON', 'TEAM_COLLAB');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not updated|not found/i);
  });

  it('transitionState returns failure when validateTransition throws', async () => {
    mockUserStateMachine.validateTransition.mockImplementation(() => {
      throw new Error('machine bug');
    });
    mockDb.run.mockResolvedValue(undefined);

    const result = await transitionState('u-1', 'ANON', 'TEAM_COLLAB');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/validation failed/i);
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  it('transitionState still succeeds when getPhase throws only for fromState audit field', async () => {
    mockUserStateMachine.validateTransition.mockReturnValue({ valid: true });
    mockUserStateMachine.getPhase.mockImplementation((state: string) => {
      if (state === 'ANON') throw new Error('getPhase boom');
      return 'B';
    });
    mockDb.run.mockResolvedValue(undefined);

    const result = await transitionState('u-1', 'ANON', 'TEAM_COLLAB');

    expect(result.success).toBe(true);
    expect(mockDb.run).toHaveBeenCalledTimes(1);
  });

  it('transitionState succeeds when context is null by coercing to empty object', async () => {
    mockUserStateMachine.validateTransition.mockReturnValue({ valid: true });
    mockDb.run.mockResolvedValue(undefined);

    const result = await transitionState('u-1', 'ANON', 'TEAM_COLLAB', null as any);

    expect(result.success).toBe(true);
    expect(mockUserStateMachine.validateTransition).toHaveBeenCalledWith(
      'ANON',
      'TEAM_COLLAB',
      {}
    );
    expect(mockDb.run).toHaveBeenCalledTimes(1);
  });

  it('transitionState returns failure when getPhase throws for target state', async () => {
    mockUserStateMachine.validateTransition.mockReturnValue({ valid: true });
    mockUserStateMachine.getPhase.mockImplementation((state: string) => {
      if (state === 'TEAM_COLLAB') {
        throw new Error('phase resolution failed');
      }
      return 'A';
    });
    mockDb.run.mockResolvedValue(undefined);

    const result = await transitionState('u-1', 'ANON', 'TEAM_COLLAB');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/phase resolution failed/i);
    expect(mockDb.run).not.toHaveBeenCalled();
  });
});
