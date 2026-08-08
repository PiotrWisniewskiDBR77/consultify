import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSnapshot = vi.fn();
const recoverTarget = vi.fn();
const getSettings = vi.fn();
const updateSettings = vi.fn();
const activateTenant = vi.fn();
vi.mock('../../../services/v8/agentOperatorConsoleService.js', () => ({
  getAgentRunOperationalSnapshot: getSnapshot,
  recoverAgentRunTarget: recoverTarget,
}));
vi.mock('../../../services/v8/agentTenantSettingsService.js', () => ({
  getAgentTenantSettings: getSettings,
  updateAgentTenantSettings: updateSettings,
  activateA06ForTenant: activateTenant,
}));

async function app(role: string) {
  const { default: router } = await import('../agent-operations.routes.js');
  const server = express();
  server.use(express.json());
  server.use((req, _res, next) => {
    (req as any).v8Context = {
      organizationId: 'org-a',
      userId: 'operator-a',
      userRole: role,
      isSuperAdmin: false,
    };
    next();
  });
  server.use('/api/v8/agent-operations', router);
  return server;
}

async function bootstrapApp(role: string) {
  const { agentOperationsBootstrapRouter } = await import('../agent-operations.routes.js');
  const server = express();
  server.use(express.json());
  server.use((req, _res, next) => {
    (req as any).v8Context = {
      organizationId: 'org-a',
      userId: 'operator-a',
      userRole: role,
      isSuperAdmin: false,
    };
    next();
  });
  server.use('/api/v8/agent-operations', agentOperationsBootstrapRouter);
  return server;
}

describe('agent operations routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('denies the operator console to an ordinary consultant', async () => {
    const response = await request(await app('CONSULTANT')).get(
      '/api/v8/agent-operations/runs/run-1'
    );
    expect(response.status).toBe(403);
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it('uses authenticated tenant and actor for a recovery action', async () => {
    recoverTarget.mockResolvedValue({ recoveryId: 'recovery-1', status: 'pending' });
    const response = await request(await app('ADMIN'))
      .post('/api/v8/agent-operations/runs/run-1/recover')
      .set('Idempotency-Key', 'recovery-key-1')
      .send({
        targetId: 'branch-1',
        action: 'retry_failed_branch',
        reason: 'Transient connector failure',
        organizationId: 'org-foreign',
        actorUserId: 'attacker',
      });
    expect(response.status).toBe(200);
    expect(recoverTarget).toHaveBeenCalledWith({
      targetId: 'branch-1',
      action: 'retry_failed_branch',
      reason: 'Transient connector failure',
      executionRunId: 'run-1',
      organizationId: 'org-a',
      actorUserId: 'operator-a',
      idempotencyKey: 'recovery-key-1',
    });
  });

  it('routes stale-review expiry with a required idempotency key', async () => {
    recoverTarget.mockResolvedValue({ recoveryId: 'recovery-expire', status: 'expired' });
    const response = await request(await app('OWNER'))
      .post('/api/v8/agent-operations/runs/run-1/recover')
      .set('Idempotency-Key', 'expire-review-key')
      .send({
        targetId: 'run-1',
        action: 'expire_stale_review',
        reason: 'Review deadline elapsed.',
      });
    expect(response.status).toBe(200);
    expect(recoverTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-a',
        actorUserId: 'operator-a',
        executionRunId: 'run-1',
        targetId: 'run-1',
        action: 'expire_stale_review',
        idempotencyKey: 'expire-review-key',
      })
    );
  });

  it('returns fail-closed defaults and uses authenticated admin identity for updates', async () => {
    getSettings.mockResolvedValue(null);
    const defaults = await request(await app('ADMIN')).get('/api/v8/agent-operations/settings');
    expect(defaults.status).toBe(200);
    expect(defaults.body.data).toMatchObject({
      in_app_enabled: true,
      email_enabled: false,
      calendar_enabled: false,
      export_enabled: false,
      purge_enabled: false,
    });

    updateSettings.mockResolvedValue({ version: 1, in_app_enabled: true });
    const response = await request(await app('OWNER'))
      .put('/api/v8/agent-operations/settings')
      .send({
        projectId: null,
        expectedVersion: 0,
        inAppEnabled: true,
        emailEnabled: false,
        calendarEnabled: false,
        cadence: 'manual',
        timezone: 'Europe/Warsaw',
        autoActions: {},
        legalHold: false,
        organizationId: 'org-foreign',
        actorUserId: 'attacker',
      });
    expect(response.status).toBe(200);
    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-a',
        actorUserId: 'operator-a',
        actorRole: 'OWNER',
      })
    );
  });

  it('requires admin authority and an idempotency key before A06 activation', async () => {
    const denied = await request(await app('CONSULTANT'))
      .post('/api/v8/agent-operations/activate')
      .set('Idempotency-Key', 'activation-key')
      .send({ projectId: null });
    expect(denied.status).toBe(403);
    expect(activateTenant).not.toHaveBeenCalled();

    const missingKey = await request(await app('ADMIN'))
      .post('/api/v8/agent-operations/activate')
      .send({ projectId: null });
    expect(missingKey.status).toBe(400);

    activateTenant.mockResolvedValue({
      receipt_id: 'receipt-1',
      policy_count: 17,
      idempotentReplay: false,
    });
    const activated = await request(await app('ADMIN'))
      .post('/api/v8/agent-operations/activate')
      .set('Idempotency-Key', 'activation-key')
      .send({ projectId: null });
    expect(activated.status).toBe(201);
    expect(activateTenant).toHaveBeenCalledWith({
      organizationId: 'org-a',
      projectId: null,
      actorUserId: 'operator-a',
      actorRole: 'ADMIN',
      idempotencyKey: 'activation-key',
    });
  });

  it('exposes only the authorized bootstrap contract before tenant V8 enablement', async () => {
    getSettings.mockResolvedValue(null);

    const settings = await request(await bootstrapApp('ADMIN')).get(
      '/api/v8/agent-operations/settings'
    );
    expect(settings.status).toBe(200);

    const denied = await request(await bootstrapApp('CONSULTANT')).get(
      '/api/v8/agent-operations/settings'
    );
    expect(denied.status).toBe(403);

    const runtimeRoute = await request(await bootstrapApp('ADMIN')).get(
      '/api/v8/agent-operations/runs/run-1'
    );
    expect(runtimeRoute.status).toBe(404);
    expect(getSnapshot).not.toHaveBeenCalled();
  });
});
