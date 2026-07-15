import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryAll = vi.fn();
const mockQueryFirst = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryFirst: (...args: unknown[]) => mockQueryFirst(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

const mockPutObject = vi.fn();
const mockGetUrl = vi.fn();

vi.mock('../../../../server/src/services/storage/index.js', () => ({
  getStorage: () => ({
    provider: 'local',
    putObject: (...args: unknown[]) => mockPutObject(...args),
    getUrl: (...args: unknown[]) => mockGetUrl(...args),
  }),
}));

let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `typed-action-uuid-${++uuidCounter}`,
}));

describe('FinalBatchService', () => {
  const ORIGINAL_ENV = process.env.IDEA_SERVER_EXPORT_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.IDEA_SERVER_EXPORT_ENABLED;
    else process.env.IDEA_SERVER_EXPORT_ENABLED = ORIGINAL_ENV;
    vi.resetModules();
  });

  it('scopes getAction to the organization', async () => {
    mockQueryFirst.mockResolvedValue({ id: 'a1' });

    const { finalBatchService } = await import('../../../../server/src/services/finalBatchService.js');
    await finalBatchService.getAction('org-1', 'a1');

    expect(mockQueryFirst).toHaveBeenCalledWith(
      expect.stringContaining('organization_id=$2'),
      ['a1', 'org-1'],
    );
  });

  it('reuses an existing action for the same org idempotency key', async () => {
    mockQueryFirst.mockResolvedValue({ id: 'existing-action' });

    const { finalBatchService } = await import('../../../../server/src/services/finalBatchService.js');
    const result = await finalBatchService.proposeAction('org-1', {
      actionType: 'update',
      targetEntityType: 'report',
      proposedChanges: { title: 'Next' },
      idempotencyKey: 'idem-1',
      proposedBy: 'user-1',
    });

    expect(result).toEqual({ id: 'existing-action', reused: true });
    expect(mockQueryRun).not.toHaveBeenCalled();
  });

  it('blocks acceptance when caller role is below required role', async () => {
    mockQueryFirst.mockResolvedValue({
      id: 'a1',
      status: 'proposed',
      rbac_required_role: 'ADMIN',
    });

    const { finalBatchService } = await import('../../../../server/src/services/finalBatchService.js');
    const result = await finalBatchService.acceptAction('org-1', 'a1', 'user-1', 'TEAM_MEMBER');

    expect(result).toEqual({
      ok: false,
      reason: 'insufficient_role',
      requiredRole: 'ADMIN',
    });
    expect(mockQueryRun).not.toHaveBeenCalled();
  });

  it('accepts action only within the same organization', async () => {
    mockQueryFirst.mockResolvedValue({
      id: 'a1',
      status: 'proposed',
      rbac_required_role: 'ADMIN',
    });
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const { finalBatchService } = await import('../../../../server/src/services/finalBatchService.js');
    const result = await finalBatchService.acceptAction('org-1', 'a1', 'user-1', 'ADMIN');

    expect(result).toEqual({ ok: true });
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('organization_id=$3'),
      ['user-1', 'a1', 'org-1'],
    );
  });

  it('executes only accepted actions in the same organization', async () => {
    mockQueryRun.mockResolvedValue({ changes: 0 });

    const { finalBatchService } = await import('../../../../server/src/services/finalBatchService.js');
    const result = await finalBatchService.executeAction('org-1', 'a1', { applied: true });

    expect(result).toEqual({ ok: false });
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('organization_id=$3'),
      [JSON.stringify({ applied: true }), 'a1', 'org-1'],
    );
  });

  describe('requestAndGenerateExport (L-05/DP-5 server export)', () => {
    it('flag OFF (default): only records the pending row, exactly like the legacy stub', async () => {
      delete process.env.IDEA_SERVER_EXPORT_ENABLED;
      vi.resetModules();
      mockQueryRun.mockResolvedValue({ changes: 1 });

      const { finalBatchService } = await import(
        '../../../../server/src/services/finalBatchService.js'
      );
      const result = await finalBatchService.requestAndGenerateExport('org-1', {
        ideaId: 'idea-1',
        exportType: 'whiteboard',
        exportFormat: 'json',
        requestedBy: 'user-1',
      });

      expect(result).toEqual({ id: 'typed-action-uuid-1', status: 'pending' });
      // requestExport only INSERTs — no idea/map lookup, no storage write.
      expect(mockQueryFirst).not.toHaveBeenCalled();
      expect(mockPutObject).not.toHaveBeenCalled();
      expect(mockQueryRun).toHaveBeenCalledTimes(1);
      expect(mockQueryRun).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO idea_exports'),
        expect.any(Array),
      );
    });

    it('flag ON: generates a real JSON file from the org-scoped idea map and completes the row', async () => {
      process.env.IDEA_SERVER_EXPORT_ENABLED = 'true';
      vi.resetModules();
      mockQueryRun.mockResolvedValue({ changes: 1 });
      mockQueryFirst
        .mockResolvedValueOnce({ title: 'My Idea' }) // my_ideas lookup
        .mockResolvedValueOnce({
          nodes_json: JSON.stringify([{ id: 'n1', data: { label: 'Root' } }]),
          edges_json: JSON.stringify([]),
        }); // my_idea_maps lookup
      mockPutObject.mockResolvedValue({ key: 'idea-exports/org-1/idea-1-x.json' });
      mockGetUrl.mockResolvedValue('/uploads/idea-exports/org-1/idea-1-x.json');

      const { finalBatchService } = await import(
        '../../../../server/src/services/finalBatchService.js'
      );
      const result = await finalBatchService.requestAndGenerateExport('org-1', {
        ideaId: 'idea-1',
        exportType: 'whiteboard',
        exportFormat: 'json',
        requestedBy: 'user-1',
      });

      expect(result).toEqual({
        id: 'typed-action-uuid-1',
        status: 'completed',
        fileUrl: '/uploads/idea-exports/org-1/idea-1-x.json',
        fileSizeBytes: expect.any(Number),
      });
      expect(mockPutObject).toHaveBeenCalledTimes(1);
      const putArgs = mockPutObject.mock.calls[0][0];
      expect(putArgs.key).toMatch(/^idea-exports\/org-1\/idea-1-/);
      expect(putArgs.contentType).toBe('application/json');
      expect(JSON.parse(putArgs.body.toString('utf-8'))).toMatchObject({
        id: 'idea-1',
        title: 'My Idea',
        nodes: [{ id: 'n1', data: { label: 'Root' } }],
      });
      // completeExport UPDATE ran (in addition to the initial requestExport INSERT).
      expect(mockQueryRun).toHaveBeenCalledWith(
        expect.stringContaining("status='completed'"),
        expect.arrayContaining(['/uploads/idea-exports/org-1/idea-1-x.json']),
      );
    });

    it('flag ON: fails the export (does not fake success) for formats needing browser canvas rendering', async () => {
      process.env.IDEA_SERVER_EXPORT_ENABLED = 'true';
      vi.resetModules();
      mockQueryRun.mockResolvedValue({ changes: 1 });

      const { finalBatchService } = await import(
        '../../../../server/src/services/finalBatchService.js'
      );
      const result = await finalBatchService.requestAndGenerateExport('org-1', {
        ideaId: 'idea-1',
        exportType: 'whiteboard',
        exportFormat: 'png',
        requestedBy: 'user-1',
      });

      expect(result).toEqual({
        id: 'typed-action-uuid-1',
        status: 'failed',
        reason: 'unsupported_format',
        message: expect.stringContaining('png'),
      });
      expect(mockPutObject).not.toHaveBeenCalled();
      expect(mockQueryRun).toHaveBeenCalledWith(
        expect.stringContaining("status='failed'"),
        expect.arrayContaining([expect.stringContaining('not implemented')]),
      );
    });

    it('flag ON: fails cleanly when the idea does not exist in this organization', async () => {
      process.env.IDEA_SERVER_EXPORT_ENABLED = 'true';
      vi.resetModules();
      mockQueryRun.mockResolvedValue({ changes: 1 });
      mockQueryFirst.mockResolvedValueOnce(null); // my_ideas lookup misses (wrong org / missing)

      const { finalBatchService } = await import(
        '../../../../server/src/services/finalBatchService.js'
      );
      const result = await finalBatchService.requestAndGenerateExport('org-1', {
        ideaId: 'idea-missing',
        exportType: 'whiteboard',
        exportFormat: 'markdown',
        requestedBy: 'user-1',
      });

      expect(result).toEqual({
        id: 'typed-action-uuid-1',
        status: 'failed',
        reason: 'idea_not_found',
        message: expect.any(String),
      });
      expect(mockPutObject).not.toHaveBeenCalled();
    });
  });
});
