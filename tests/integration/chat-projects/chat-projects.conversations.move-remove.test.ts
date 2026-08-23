import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { CreateInitiativeSchema } from '../../../server/src/validators/initiative.validators.js';
import { makeChatProjectsApp } from './_helpers/makeChatProjectsApp';

const { db, getDatabase, logAuditEvent, queryAuditEvents, transactionQuery, withPgTransaction } = vi.hoisted(() => ({
  db: {
    queryOne: vi.fn(),
    query: vi.fn(),
    run: vi.fn(),
  },
  getDatabase: vi.fn(),
  logAuditEvent: vi.fn(),
  queryAuditEvents: vi.fn(),
  transactionQuery: vi.fn(),
  withPgTransaction: vi.fn(),
}));

vi.mock('../../../server/src/database/index.js', () => ({
  getDatabase: () => getDatabase(),
}));

vi.mock('../../../server/src/services/chatPermissionService.js', () => ({
  checkChatPermission: vi.fn().mockResolvedValue({
    allowed: true,
    role: 'owner',
    reason: '',
  }),
}));

vi.mock('../../../server/src/services/AuditEventsService.js', () => ({
  default: { log: logAuditEvent, query: queryAuditEvents },
}));

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  withPgTransaction,
}));

describe('Chat projects routes: move/remove conversation (REAL integration)', () => {
  void CreateInitiativeSchema;
  const origNodeEnv = process.env.NODE_ENV;
  const origBypass = process.env.ENABLE_TEST_AUTH_BYPASS;
  const origMockDb = process.env.MOCK_DB;
  const origTestType = process.env.TEST_TYPE;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    process.env.MOCK_DB = 'false';
    process.env.TEST_TYPE = 'integration';
  });

  afterAll(() => {
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
    if (origBypass === undefined) delete process.env.ENABLE_TEST_AUTH_BYPASS;
    else process.env.ENABLE_TEST_AUTH_BYPASS = origBypass;
    if (origMockDb === undefined) delete process.env.MOCK_DB;
    else process.env.MOCK_DB = origMockDb;
    if (origTestType === undefined) delete process.env.TEST_TYPE;
    else process.env.TEST_TYPE = origTestType;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getDatabase.mockReturnValue(db);
    db.run.mockResolvedValue({ changes: 1 });
    db.query.mockResolvedValue([]);
    logAuditEvent.mockResolvedValue('ae-visibility-1');
    queryAuditEvents.mockResolvedValue({ data: [], total: 0 });
    transactionQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    withPgTransaction.mockImplementation(async (work) => work({ query: transactionQuery }));
  });

  it('reads back only canonical visibility receipts for an accessible conversation', async () => {
    db.queryOne.mockResolvedValueOnce({ id: 'c1', user_id: 'u-1' });
    queryAuditEvents.mockResolvedValueOnce({
      total: 2,
      data: [
        {
          id: 'ae-visibility-1',
          timestamp: '2026-08-23T12:00:00.000Z',
          actorId: 'u-1',
          action: 'chat.visibility_consent_recorded',
          before: { folderId: null, scope: 'private_unassigned' },
          after: { folderId: 'p1', scope: 'organization' },
          metadata: {
            policyVersion: 'chat-history-visibility-v1',
            requestedOperation: 'move_to_organization_folder',
            destinationOrganizationId: 'org-1',
          },
        },
        { id: 'ae-other', action: 'chat.message_sent' },
      ],
    });
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app).get(
      '/api/chat-projects/conversations/c1/visibility-receipts'
    );

    expect(res.status).toBe(200);
    expect(res.body.receipts).toEqual([
      expect.objectContaining({
        id: 'ae-visibility-1',
        policyVersion: 'chat-history-visibility-v1',
        from: expect.objectContaining({ scope: 'private_unassigned' }),
        to: expect.objectContaining({ scope: 'organization' }),
      }),
    ]);
    expect(queryAuditEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        resourceType: 'conversation',
        resourceId: 'c1',
      })
    );
  });

  it('does not disclose visibility receipts for an inaccessible conversation', async () => {
    db.queryOne.mockResolvedValueOnce(null);
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app).get(
      '/api/chat-projects/conversations/foreign/visibility-receipts'
    );

    expect(res.status).toBe(404);
    expect(queryAuditEvents).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'same-org unassigned non-owner',
      row: { id: 'c1', user_id: 'u-2', organization_id: 'org-1', chat_project_id: null },
    },
    {
      label: 'same-org personal-folder non-owner',
      row: {
        id: 'c1',
        user_id: 'u-2',
        organization_id: 'org-1',
        chat_project_id: 'personal-1',
        project_scope: 'personal',
        project_visibility: 'org',
      },
    },
    {
      label: 'same-org private-team nonmember or revoked member',
      row: {
        id: 'c1',
        user_id: 'u-2',
        organization_id: 'org-1',
        chat_project_id: 'team-private',
        project_user_id: 'u-2',
        project_scope: 'team',
        project_visibility: 'private',
        is_project_member: 0,
      },
    },
    {
      label: 'foreign tenant member flag cannot cross the tenant boundary',
      row: {
        id: 'c1',
        user_id: 'u-2',
        organization_id: 'org-2',
        chat_project_id: 'team-private',
        project_scope: 'team',
        project_visibility: 'private',
        is_project_member: 1,
      },
    },
  ])('denies $label without querying audit history', async ({ row }) => {
    db.queryOne.mockResolvedValueOnce(row);
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app).get(
      '/api/chat-projects/conversations/c1/visibility-receipts'
    );

    expect(res.status).toBe(404);
    expect(queryAuditEvents).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'private-team member',
      row: {
        id: 'c1',
        user_id: 'u-2',
        organization_id: 'org-1',
        chat_project_id: 'team-private',
        project_scope: 'team',
        project_visibility: 'private',
        is_project_member: 1,
      },
    },
    {
      label: 'private-team project owner',
      row: {
        id: 'c1',
        user_id: 'u-2',
        organization_id: 'org-1',
        chat_project_id: 'team-private',
        project_user_id: 'u-1',
        project_scope: 'team',
        project_visibility: 'private',
        is_project_member: 0,
      },
    },
    {
      label: 'open organization project member by policy',
      row: {
        id: 'c1',
        user_id: 'u-2',
        organization_id: 'org-1',
        chat_project_id: 'team-open',
        project_scope: 'team',
        project_visibility: 'org',
        is_project_member: 0,
      },
    },
  ])('allows $label to query scoped audit history', async ({ row }) => {
    db.queryOne.mockResolvedValueOnce(row);
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app).get(
      '/api/chat-projects/conversations/c1/visibility-receipts'
    );

    expect(res.status).toBe(200);
    expect(queryAuditEvents).toHaveBeenCalledOnce();
  });

  it('POST /:id/conversations/:conversationId returns 404 when project is missing', async () => {
    db.queryOne.mockResolvedValueOnce(null);
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app).post('/api/chat-projects/p1/conversations/c1');
    expect(res.status).toBe(404);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Project not found' }));
  });

  it('returns shared context owner, provenance, version, hash and audit history', async () => {
    db.queryOne.mockResolvedValueOnce({
      id: 'p1',
      user_id: 'u-1',
      scope: 'team',
      organization_id: 'org-1',
      visibility: 'private',
    });
    db.query.mockResolvedValueOnce([
      {
        id: 'k1',
        kind: 'text',
        title: 'Mandate',
        content: 'Grow in EU',
        added_by: 'u-1',
        added_at: '2026-08-23T12:00:00.000Z',
        version: 1,
        content_hash: 'sha256:abc',
        hash_basis: 'content',
        provenance_json: JSON.stringify({ type: 'user_note', reference: null }),
      },
    ]);
    queryAuditEvents.mockResolvedValueOnce({
      total: 1,
      data: [
        {
          id: 'ae-context-1',
          action: 'chat.project_context_added',
          actorId: 'u-1',
          after: { knowledgeId: 'k1', version: 1, contentHash: 'sha256:abc' },
        },
      ],
    });
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app).get('/api/chat-projects/p1/knowledge');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        historyStatus: 'available',
        knowledge: [
          expect.objectContaining({
            id: 'k1',
            added_by: 'u-1',
            version: 1,
            content_hash: 'sha256:abc',
            hash_basis: 'content',
            provenance: { type: 'user_note', reference: null },
          }),
        ],
        history: [expect.objectContaining({ id: 'ae-context-1' })],
      })
    );
    expect(queryAuditEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        resourceType: 'chat_project_context',
        resourceId: 'p1',
      })
    );
  });

  it('denies shared context readback to a foreign-tenant member before history lookup', async () => {
    db.queryOne.mockResolvedValueOnce({
      id: 'p1',
      user_id: 'u-2',
      scope: 'team',
      organization_id: 'org-2',
      visibility: 'private',
    });
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app).get('/api/chat-projects/p1/knowledge');

    expect(res.status).toBe(403);
    expect(db.query).not.toHaveBeenCalled();
    expect(queryAuditEvents).not.toHaveBeenCalled();
  });

  it('atomically creates versioned shared context and its audit event', async () => {
    db.queryOne
      .mockResolvedValueOnce({
        id: 'p1',
        user_id: 'u-1',
        scope: 'team',
        organization_id: 'org-1',
      })
      .mockResolvedValueOnce({ role: 'owner' });
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app)
      .post('/api/chat-projects/p1/knowledge')
      .send({ kind: 'text', title: 'Mandate', content: 'Grow in EU' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        ownerId: 'u-1',
        version: 1,
        provenance: { type: 'user_note', reference: null },
        contentHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        hashBasis: 'content',
      })
    );
    expect(transactionQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO project_knowledge'),
      expect.arrayContaining(['p1', 'u-1', 1])
    );
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'chat.project_context_added',
        resourceType: 'chat_project_context',
        resourceId: 'p1',
        after: expect.objectContaining({ ownerId: 'u-1', version: 1 }),
      })
    );
  });

  it('atomically records context provenance before removal', async () => {
    db.queryOne
      .mockResolvedValueOnce({ user_id: 'u-1', scope: 'team', organization_id: 'org-1' })
      .mockResolvedValueOnce({ role: 'owner' })
      .mockResolvedValueOnce({
        id: 'k1',
        kind: 'file',
        title: 'Plan',
        doc_id: 'doc-1',
        added_by: 'u-2',
        version: 1,
        content_hash: 'sha256:def',
        hash_basis: 'source_reference',
        provenance_json: JSON.stringify({ type: 'uploaded_document', reference: 'doc-1' }),
      });
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app).delete('/api/chat-projects/p1/knowledge/k1');

    expect(res.status).toBe(200);
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'chat.project_context_removed',
        before: expect.objectContaining({
          knowledgeId: 'k1',
          ownerId: 'u-2',
          version: 1,
          contentHash: 'sha256:def',
          hashBasis: 'source_reference',
          provenance: { type: 'uploaded_document', reference: 'doc-1' },
        }),
      })
    );
    expect(transactionQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM project_knowledge'),
      ['k1', 'p1']
    );
  });

  it('requires explicit visibility consent when private content enters a team folder', async () => {
    db.queryOne
      .mockResolvedValueOnce({ id: 'p1', scope: 'team', organization_id: 'org-1' })
      .mockResolvedValueOnce({ id: 'c1', chat_project_id: null });
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app).post('/api/chat-projects/p1/conversations/c1');
    expect(res.status).toBe(409);
    expect(res.body).toEqual(
      expect.objectContaining({ code: 'VISIBILITY_CONSENT_REQUIRED' })
    );
    expect(transactionQuery).not.toHaveBeenCalled();
  });

  it('POST /:id/conversations/:conversationId returns 404 when conversation is missing', async () => {
    db.queryOne
      .mockResolvedValueOnce({ id: 'p1', scope: 'personal', user_id: 'u-1' }) // project
      .mockResolvedValueOnce(null); // conversation
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app).post('/api/chat-projects/p1/conversations/c404');
    expect(res.status).toBe(404);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Conversation not found' }));
  });

  it('POST /:id/conversations/:conversationId moves the conversation on success', async () => {
    db.queryOne
      .mockResolvedValueOnce({ id: 'p1', scope: 'team', organization_id: 'org-1' }) // project
      .mockResolvedValueOnce({ id: 'c1' }); // conversation
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app)
      .post('/api/chat-projects/p1/conversations/c1')
      .send({ visibilityConsent: true });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, visibilityReceiptId: 'ae-visibility-1' });
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'chat.visibility_consent_recorded',
        resourceType: 'conversation',
        resourceId: 'c1',
        before: expect.objectContaining({ scope: 'private_unassigned' }),
        after: expect.objectContaining({ scope: 'organization', folderId: 'p1' }),
        metadata: expect.objectContaining({
          policyVersion: 'chat-history-visibility-v1',
          requestedOperation: 'move_to_organization_folder',
        }),
      })
    );
    expect(transactionQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE conversations SET chat_project_id = ?'),
      expect.arrayContaining(['p1', 'c1'])
    );
  });

  it('fails closed before the move when the visibility audit receipt cannot persist', async () => {
    db.queryOne
      .mockResolvedValueOnce({ id: 'p1', scope: 'team', organization_id: 'org-1' })
      .mockResolvedValueOnce({ id: 'c1', chat_project_id: null });
    logAuditEvent.mockRejectedValueOnce(new Error('audit unavailable'));
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app)
      .post('/api/chat-projects/p1/conversations/c1')
      .send({ visibilityConsent: true });
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ code: 'VISIBILITY_MOVE_ATOMIC_FAILURE' }));
    expect(transactionQuery).not.toHaveBeenCalled();
  });

  it('rolls back the consent receipt when the conversation move cannot commit', async () => {
    db.queryOne
      .mockResolvedValueOnce({ id: 'p1', scope: 'team', organization_id: 'org-1' })
      .mockResolvedValueOnce({ id: 'c1', chat_project_id: null });
    withPgTransaction.mockImplementationOnce(async (work) => {
      await work({ query: transactionQuery });
      throw new Error('move transaction rolled back');
    });
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app)
      .post('/api/chat-projects/p1/conversations/c1')
      .send({ visibilityConsent: true });
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ code: 'VISIBILITY_MOVE_ATOMIC_FAILURE' }));
    expect(logAuditEvent).toHaveBeenCalledOnce();
    expect(transactionQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE conversations SET chat_project_id = ?'),
      expect.arrayContaining(['p1', 'c1'])
    );
  });

  it('DELETE /:id/conversations/:conversationId clears chat_project_id (best-effort)', async () => {
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app).delete('/api/chat-projects/p2/conversations/c2');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('SET chat_project_id = NULL'),
      expect.arrayContaining(['c2', 'p2', 'u-1', 'org-1'])
    );
  });

  it('POST /:id/conversations/:conversationId fails the governed move when update fails', async () => {
    db.queryOne
      .mockResolvedValueOnce({ id: 'p1', scope: 'team', organization_id: 'org-1' }) // project
      .mockResolvedValueOnce({ id: 'c1' }); // conversation
    transactionQuery.mockRejectedValueOnce(new Error('db fail'));
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app)
      .post('/api/chat-projects/p1/conversations/c1')
      .send({ visibilityConsent: true });
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ code: 'VISIBILITY_MOVE_ATOMIC_FAILURE' }));
  });
});
