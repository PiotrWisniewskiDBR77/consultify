/**
 * Fala sprzątania 1b (2026-07-27) — retry/rekoncyliacja rejestracji artefaktu.
 *
 * `registerGeneratedDocumentOrigin` (document-studio.routes.ts) used to call
 * `registerArtifactOrigin` / `registerOutputArtifactTransactional` exactly
 * ONCE, fire-and-forget, logging any failure at `warn` with no `artifactId`
 * in the structured fields — a document could materialize successfully and
 * silently never appear in the Outputs Library, with no findable trace
 * (rejestr: "dokument może powstać i nigdy nie pojawić się w bibliotece").
 *
 * This suite drives the real production entry point (`POST
 * /api/document-studio/generate`, not the retry helper in isolation) and
 * verifies:
 *   1. a registration that fails once then succeeds is retried and lands
 *      (no `error`-level log — the retry absorbed the transient failure);
 *   2. a registration that fails on every attempt is retried the configured
 *      number of times and THEN logged at `error` level WITH the artifactId,
 *      instead of the old single silent `warn`.
 *
 * The HTTP response itself must stay fail-soft either way: registration is
 * fire-and-forget, so `/generate` responds before the retry/backoff settles.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUser = { id: 'user-retry-1', organizationId: 'org-retry-A', role: 'CONSULTANT' };

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    next();
  },
}));

vi.mock('../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
}));

const FAKE_ARTIFACT_ID = 'artifact-retry-test-1';

vi.mock('../../services/documentStudio/documentStudioService.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/documentStudio/documentStudioService.js')>();
  return {
    ...actual,
    materializeDocumentArtifact: vi.fn(async () => ({
      artifactId: FAKE_ARTIFACT_ID,
      schema: { title: 'Retry test document' },
      generationWarnings: [],
    })),
  };
});

const registerArtifactOriginMock = vi.fn();

vi.mock('../../services/v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: (...args: unknown[]) => registerArtifactOriginMock(...args),
}));

const registerOutputArtifactTransactionalMock = vi.fn(async () => ({
  artifactId: FAKE_ARTIFACT_ID,
  isNew: true,
  lineage: {},
}));

vi.mock('../../services/v8/outputsTransactionalRegistry.js', () => ({
  registerOutputArtifactTransactional: (...args: unknown[]) =>
    registerOutputArtifactTransactionalMock(...args),
}));

const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock('../../utils/Logger.js', () => ({
  default: {
    warn: (...args: unknown[]) => loggerWarnMock(...args),
    error: (...args: unknown[]) => loggerErrorMock(...args),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import documentStudioRoutes from '../document-studio.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/document-studio', documentStudioRoutes);
  return app;
}

/** Let the fire-and-forget retry/backoff chain settle before asserting on it. */
async function flushRetries(ms = 700): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('registerGeneratedDocumentOrigin — retry on transient registration failure', () => {
  it('retries after one failed attempt and succeeds — no error-level log', async () => {
    registerArtifactOriginMock
      .mockRejectedValueOnce(new Error('transient DB hiccup'))
      .mockResolvedValueOnce({ artifactId: FAKE_ARTIFACT_ID });

    const res = await request(createApp())
      .post('/api/document-studio/generate')
      .send({ intake: { title: 'Retry test document' } });

    expect(res.status).toBe(200);
    expect(res.body.artifactId).toBe(FAKE_ARTIFACT_ID);

    await flushRetries();

    expect(registerArtifactOriginMock).toHaveBeenCalledTimes(2);
    // First (failed) attempt logged at warn, with the artifactId already present.
    const warnCall = loggerWarnMock.mock.calls.find(
      (call) =>
        typeof call[0] === 'string' && call[0].includes('Outputs registration attempt failed')
    );
    expect(warnCall).toBeDefined();
    expect(warnCall?.[1]).toMatchObject({ artifactId: FAKE_ARTIFACT_ID, attempt: 1 });

    // Retry absorbed the failure — no permanent-failure error log for this path.
    const permanentFailureLog = loggerErrorMock.mock.calls.find(
      (call) =>
        typeof call[0] === 'string' && call[0].includes('Outputs registration permanently failed')
    );
    expect(permanentFailureLog).toBeUndefined();
  });

  it('logs at error level WITH the artifactId when every attempt fails', async () => {
    registerArtifactOriginMock.mockRejectedValue(new Error('registry unavailable'));

    const res = await request(createApp())
      .post('/api/document-studio/generate')
      .send({ intake: { title: 'Retry test document' } });

    expect(res.status).toBe(200);

    await flushRetries();

    // 3 total attempts (default retryWithBackoff configuration).
    expect(registerArtifactOriginMock).toHaveBeenCalledTimes(3);

    const permanentFailureLog = loggerErrorMock.mock.calls.find(
      (call) =>
        typeof call[0] === 'string' && call[0].includes('Outputs registration permanently failed')
    );
    expect(permanentFailureLog).toBeDefined();
    expect(permanentFailureLog?.[1]).toMatchObject({
      artifactId: FAKE_ARTIFACT_ID,
      organizationId: mockUser.organizationId,
    });
  });
});
