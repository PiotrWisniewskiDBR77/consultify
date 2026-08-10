import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetV8Context = vi.fn();
const mockRequireOrgMember = vi.fn();
const mockRequireOrgRole = vi.fn();
const mockRegisterCapability = vi.fn();
const mockListCapabilities = vi.fn();
const mockMarkCapabilityHealth = vi.fn();
const mockRecordIdempotencyKeyCheck = vi.fn();

vi.mock('../../../middleware/v8Auth.middleware.js', () => ({
  getV8Context: (...args: unknown[]) => mockGetV8Context(...args),
}));

vi.mock('../../../services/caseWorkspace/caseWorkspaceAuthContext.js', async () => {
  const actual = await vi.importActual<typeof import('../../../services/caseWorkspace/caseWorkspaceAuthContext.js')>(
    '../../../services/caseWorkspace/caseWorkspaceAuthContext.js'
  );
  return {
    ...actual,
    requireOrgMember: (...args: unknown[]) => mockRequireOrgMember(...args),
    requireOrgRole: (...args: unknown[]) => mockRequireOrgRole(...args),
  };
});

vi.mock('../../../services/caseWorkspace/capabilityRegistryService.js', () => ({
  registerCapability: (...args: unknown[]) => mockRegisterCapability(...args),
  getCapabilityVersion: vi.fn(),
  getCapabilityByRegistryId: vi.fn(),
  listCapabilities: (...args: unknown[]) => mockListCapabilities(...args),
  listActiveCapabilities: vi.fn(),
  markCapabilityHealth: (...args: unknown[]) => mockMarkCapabilityHealth(...args),
  recordIdempotencyKeyCheck: (...args: unknown[]) => mockRecordIdempotencyKeyCheck(...args),
}));

import capabilitiesRoutes from '../capabilities.routes.js';
import { errorHandlerMiddleware } from '../../../utils/ErrorHandler.js';

const ORG = 'org-1';
const USER = 'user-1';

const VALID_CAPABILITY = {
  capabilityId: 'cap-1',
  capabilityVersion: '1.0.0',
  ownerModule: 'documents',
  providerType: 'INTERNAL',
  operation: 'create',
  owningCommandRef: 'cmd-1',
  inputSchemaRef: 'schema-in',
  outputSchemaRef: 'schema-out',
  operationClass: 'MUTATE',
  effectClass: 'SAFE_ADDITIVE',
  dataClassification: 'internal',
  idempotencyStrategy: 'natural-key',
  reversibility: 'reversible',
  approvalRecommendation: 'auto_executable',
};

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8/case-workspace', capabilitiesRoutes);
  app.use(errorHandlerMiddleware);
  return app;
}

describe('caseWorkspace capabilities routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetV8Context.mockReturnValue({ organizationId: ORG, userId: USER, userRole: 'ADMIN', isSuperAdmin: false });
    mockRequireOrgMember.mockResolvedValue({ membershipId: 'm1', organizationId: ORG, userId: USER, role: 'ADMIN' });
    mockRequireOrgRole.mockResolvedValue({ membershipId: 'm1', organizationId: ORG, userId: USER, role: 'ADMIN' });
  });

  it('rejects a register-capability body missing required fields with 400', async () => {
    const res = await request(createApp()).post('/api/v8/case-workspace/capabilities').send({});
    expect(res.status).toBe(400);
    expect(mockRegisterCapability).not.toHaveBeenCalled();
  });

  it('gates capability registration behind ADMIN org-role (platform-global registry mutation)', async () => {
    mockRegisterCapability.mockResolvedValue({ capabilityRegistryId: 'cwcap-1' });
    const res = await request(createApp()).post('/api/v8/case-workspace/capabilities').send(VALID_CAPABILITY);
    expect(res.status).toBe(201);
    expect(mockRequireOrgRole).toHaveBeenCalledWith(USER, ORG, 'ADMIN');
  });

  it('rejects an unrecognized effectClass enum value with 400', async () => {
    const res = await request(createApp())
      .post('/api/v8/case-workspace/capabilities')
      .send({ ...VALID_CAPABILITY, effectClass: 'NOT_A_CLASS' });
    expect(res.status).toBe(400);
  });

  it('maps insufficient_org_role to 403 for a non-admin actor attempting to register', async () => {
    const { CaseWorkspaceAuthError } = await import('../../../services/caseWorkspace/caseWorkspaceAuthContext.js');
    mockRequireOrgRole.mockRejectedValue(new CaseWorkspaceAuthError('insufficient_org_role', 'not enough role'));
    const res = await request(createApp()).post('/api/v8/case-workspace/capabilities').send(VALID_CAPABILITY);
    expect(res.status).toBe(403);
  });

  it('maps capability_already_registered to 409', async () => {
    mockRegisterCapability.mockRejectedValue(new Error('capability_already_registered'));
    const res = await request(createApp()).post('/api/v8/case-workspace/capabilities').send(VALID_CAPABILITY);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CAPABILITY_ALREADY_REGISTERED');
  });

  it('allows any authenticated org member to list capabilities (read, not gated by ADMIN)', async () => {
    mockListCapabilities.mockResolvedValue([]);
    const res = await request(createApp()).get('/api/v8/case-workspace/capabilities');
    expect(res.status).toBe(200);
    expect(mockRequireOrgMember).toHaveBeenCalledWith(USER, ORG);
    expect(mockRequireOrgRole).not.toHaveBeenCalled();
  });

  it('requires an Idempotency-Key for the idempotency-check route', async () => {
    const res = await request(createApp())
      .post('/api/v8/case-workspace/capabilities/by-id/cwcap-1/idempotency-check')
      .send({ requestPayload: { a: 1 } });
    expect(res.status).toBe(400);
    expect(mockRecordIdempotencyKeyCheck).not.toHaveBeenCalled();
  });

  it('threads the Idempotency-Key header into recordIdempotencyKeyCheck', async () => {
    mockRecordIdempotencyKeyCheck.mockResolvedValue({ isDuplicate: false, recordedAt: '2026-01-01T00:00:00.000Z' });
    const res = await request(createApp())
      .post('/api/v8/case-workspace/capabilities/by-id/cwcap-1/idempotency-check')
      .set('Idempotency-Key', 'idem-key-1')
      .send({ requestPayload: { a: 1 } });
    expect(res.status).toBe(201);
    expect(mockRecordIdempotencyKeyCheck).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'idem-key-1', capabilityRegistryId: 'cwcap-1' }),
      ORG
    );
  });
});
