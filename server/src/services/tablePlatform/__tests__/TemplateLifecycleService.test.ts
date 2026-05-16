/**
 * Unit tests for TemplateLifecycleService (Block A · EPIC-T6).
 *
 * Coverage:
 *   - listTemplates with status / category filters + invalid status rejection
 *   - getTemplate happy path + null on miss
 *   - getTemplateGovernance derives from getTemplate
 *   - approveTemplate happy path: SQL shape, audit emit, idempotency on re-apply
 *   - approveTemplate rejects invalid transitions (deprecated → approved)
 *   - deprecateTemplate happy path + transition matrix
 *   - revertToDraft happy path
 *   - approval_history append shape (event, actor, previous_status)
 *   - actor required validation
 *   - templateId not found → typed error code TEMPLATE_NOT_FOUND
 *   - Audit emit failure does NOT roll back state mutation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();
const mockLogEvent = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../AuditService.js', () => ({
  default: {
    logEvent: (...args: unknown[]) => mockLogEvent(...args),
  },
}));

import templateLifecycleService from '../TemplateLifecycleService.js';

const TEMPLATE_ID = 'tpl-uuid-1';
const ACTOR_ID = 'user-actor-1';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: TEMPLATE_ID,
    name: 'CRM Pipeline',
    description: 'Track leads',
    category: 'sales',
    thumbnail_url: null,
    schema_snapshot: { tables: [] },
    is_featured: true,
    usage_count: 5,
    created_by: 'system',
    created_at: '2026-04-01T00:00:00.000Z',
    status: 'draft',
    version: '1.0.0',
    owner_user_id: null,
    approval_history: [],
    governance_rules: {},
    ...overrides,
  };
}

describe('TemplateLifecycleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogEvent.mockResolvedValue(undefined);
  });

  // ── listTemplates ──────────────────────────────────────────────────────────

  it('listTemplates without filters returns all rows ordered by featured/usage', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [row(), row({ id: 'tpl-2', name: 'Z' })] });

    const result = await templateLifecycleService.listTemplates();

    expect(result).toHaveLength(2);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('FROM   tp_base_templates');
    expect(sql).toContain('ORDER BY is_featured DESC, usage_count DESC, name ASC');
    expect(params).toEqual([]);
  });

  it('listTemplates with single status filter passes ANY($1::text[])', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [row({ status: 'approved' })] });

    const result = await templateLifecycleService.listTemplates({ status: 'approved' });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('approved');
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('status = ANY($1::text[])');
    expect(params).toEqual([['approved']]);
  });

  it('listTemplates with multiple statuses passes both into ANY array', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await templateLifecycleService.listTemplates({ status: ['approved', 'draft'] });

    const [, params] = mockQuery.mock.calls[0];
    expect(params).toEqual([['approved', 'draft']]);
  });

  it('listTemplates with status + category combines AND clauses', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await templateLifecycleService.listTemplates({ status: 'approved', category: 'sales' });

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('status = ANY($1::text[])');
    expect(sql).toContain('category = $2');
    expect(params).toEqual([['approved'], 'sales']);
  });

  it('listTemplates rejects invalid status values', async () => {
    await expect(
      templateLifecycleService.listTemplates({ status: 'banana' as unknown as 'draft' })
    ).rejects.toThrow(/Invalid template status/);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // ── getTemplate / getTemplateGovernance ────────────────────────────────────

  it('getTemplate returns null when not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await templateLifecycleService.getTemplate(TEMPLATE_ID);

    expect(result).toBeNull();
  });

  it('getTemplate parses string-encoded JSON columns', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        row({
          schema_snapshot: '{"tables":[{"name":"X"}]}',
          approval_history: '[]',
          governance_rules: '{"reviewers":["user-1"]}',
        }),
      ],
    });

    const result = await templateLifecycleService.getTemplate(TEMPLATE_ID);

    expect(result?.schema_snapshot).toEqual({ tables: [{ name: 'X' }] });
    expect(result?.governance_rules).toEqual({ reviewers: ['user-1'] });
  });

  it('getTemplate throws on missing templateId', async () => {
    await expect(templateLifecycleService.getTemplate('')).rejects.toThrow(/templateId/);
  });

  it('getTemplateGovernance returns null when template missing', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await templateLifecycleService.getTemplateGovernance(TEMPLATE_ID);

    expect(result).toBeNull();
  });

  it('getTemplateGovernance projects only governance fields', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        row({
          status: 'approved',
          version: '2.1.0',
          owner_user_id: 'admin-1',
          governance_rules: { mandatory_reviewers: ['admin-2'] },
          approval_history: [{ event: 'approved', at: '2026-05-08T00:00:00Z', actor: 'admin-1' }],
        }),
      ],
    });

    const result = await templateLifecycleService.getTemplateGovernance(TEMPLATE_ID);

    expect(result).toEqual({
      status: 'approved',
      version: '2.1.0',
      owner_user_id: 'admin-1',
      governance_rules: { mandatory_reviewers: ['admin-2'] },
      approval_history: [{ event: 'approved', at: '2026-05-08T00:00:00Z', actor: 'admin-1' }],
    });
  });

  // ── approveTemplate ────────────────────────────────────────────────────────

  it('approveTemplate transitions draft → approved and emits audit', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [row({ status: 'draft' })] })
      .mockResolvedValueOnce({ rows: [row({ status: 'approved', owner_user_id: ACTOR_ID })] });

    const updated = await templateLifecycleService.approveTemplate(TEMPLATE_ID, {
      actorUserId: ACTOR_ID,
      note: 'reviewed',
    });

    expect(updated.status).toBe('approved');
    expect(updated.owner_user_id).toBe(ACTOR_ID);

    // Verify the UPDATE SQL shape.
    const [updateSql, updateParams] = mockQuery.mock.calls[1];
    expect(updateSql).toContain('UPDATE tp_base_templates');
    expect(updateSql).toContain('approval_history = approval_history || $3::jsonb');
    expect(updateParams[0]).toBe('approved');
    expect(updateParams[1]).toBe(ACTOR_ID);
    expect(updateParams[3]).toBe(TEMPLATE_ID);

    // history payload shape
    const historyPayload = JSON.parse(updateParams[2] as string);
    expect(historyPayload).toHaveLength(1);
    expect(historyPayload[0]).toMatchObject({
      event: 'approved',
      actor: ACTOR_ID,
      note: 'reviewed',
      previous_status: 'draft',
    });
    expect(typeof historyPayload[0].at).toBe('string');

    // Audit emit
    expect(mockLogEvent).toHaveBeenCalledTimes(1);
    const [eventType, entityType, entityId, actorId, before, after, metadata] =
      mockLogEvent.mock.calls[0];
    expect(eventType).toBe('template_approved');
    expect(entityType).toBe('template');
    expect(entityId).toBe(TEMPLATE_ID);
    expect(actorId).toBe(ACTOR_ID);
    expect(before).toEqual({ status: 'draft' });
    expect(after).toEqual({ status: 'approved' });
    expect(metadata).toMatchObject({
      template_name: 'CRM Pipeline',
      template_category: 'sales',
      note: 'reviewed',
    });
  });

  it('approveTemplate is idempotent when already approved (no UPDATE, no audit)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [row({ status: 'approved' })] });

    const result = await templateLifecycleService.approveTemplate(TEMPLATE_ID, {
      actorUserId: ACTOR_ID,
    });

    expect(result.status).toBe('approved');
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  it('approveTemplate rejects deprecated → approved transition', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [row({ status: 'deprecated' })] });

    await expect(
      templateLifecycleService.approveTemplate(TEMPLATE_ID, { actorUserId: ACTOR_ID })
    ).rejects.toMatchObject({
      message: expect.stringContaining("from 'deprecated' to 'approved'"),
    });
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  it('approveTemplate throws TEMPLATE_NOT_FOUND with code when missing', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(
      templateLifecycleService.approveTemplate(TEMPLATE_ID, { actorUserId: ACTOR_ID })
    ).rejects.toMatchObject({
      message: expect.stringContaining('Template not found'),
      code: 'TEMPLATE_NOT_FOUND',
    });
  });

  it('approveTemplate requires actorUserId', async () => {
    await expect(
      templateLifecycleService.approveTemplate(TEMPLATE_ID, { actorUserId: '' })
    ).rejects.toThrow(/actorUserId/);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // ── deprecateTemplate ──────────────────────────────────────────────────────

  it('deprecateTemplate transitions approved → deprecated', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [row({ status: 'approved' })] })
      .mockResolvedValueOnce({ rows: [row({ status: 'deprecated' })] });

    const updated = await templateLifecycleService.deprecateTemplate(TEMPLATE_ID, {
      actorUserId: ACTOR_ID,
    });

    expect(updated.status).toBe('deprecated');
    const [eventType] = mockLogEvent.mock.calls[0];
    expect(eventType).toBe('template_deprecated');
  });

  it('deprecateTemplate also accepts draft → deprecated', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [row({ status: 'draft' })] })
      .mockResolvedValueOnce({ rows: [row({ status: 'deprecated' })] });

    const updated = await templateLifecycleService.deprecateTemplate(TEMPLATE_ID, {
      actorUserId: ACTOR_ID,
    });

    expect(updated.status).toBe('deprecated');
  });

  // ── revertToDraft ──────────────────────────────────────────────────────────

  it('revertToDraft moves approved back to draft', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [row({ status: 'approved' })] })
      .mockResolvedValueOnce({ rows: [row({ status: 'draft' })] });

    const updated = await templateLifecycleService.revertToDraft(TEMPLATE_ID, {
      actorUserId: ACTOR_ID,
    });

    expect(updated.status).toBe('draft');
    const [eventType] = mockLogEvent.mock.calls[0];
    expect(eventType).toBe('template_reverted_to_draft');
  });

  // ── audit-failure resilience ───────────────────────────────────────────────

  it('lifecycle write succeeds even when audit emit fails', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [row({ status: 'draft' })] })
      .mockResolvedValueOnce({ rows: [row({ status: 'approved' })] });
    mockLogEvent.mockRejectedValueOnce(new Error('audit DB down'));

    const updated = await templateLifecycleService.approveTemplate(TEMPLATE_ID, {
      actorUserId: ACTOR_ID,
    });

    expect(updated.status).toBe('approved');
    expect(mockLogEvent).toHaveBeenCalledTimes(1);
  });

  // ── race / disappeared ─────────────────────────────────────────────────────

  it('lifecycle transition raises TEMPLATE_NOT_FOUND when row vanishes mid-update', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [row({ status: 'draft' })] })
      .mockResolvedValueOnce({ rows: [] }); // race: deleted between fetch and update

    await expect(
      templateLifecycleService.approveTemplate(TEMPLATE_ID, { actorUserId: ACTOR_ID })
    ).rejects.toMatchObject({
      code: 'TEMPLATE_NOT_FOUND',
    });
  });
});
