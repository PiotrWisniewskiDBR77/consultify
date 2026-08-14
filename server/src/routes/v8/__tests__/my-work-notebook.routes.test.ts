import express, { type Express } from 'express';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Multipart behavior is part of this route contract. The global test setup's
// lightweight multer stand-in deliberately leaves `.array()` empty, so use
// the real parser for upload coverage in this suite.
vi.unmock('multer');

const mockGetTableColumns = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();
const mockCreateAIProposal = vi.fn();
const mockGetProposalsForPage = vi.fn();
const mockResolveAIProposal = vi.fn();
const mockConvertNotebookPage = vi.fn();
const mockNotebookCapture = vi.fn();
const mockResolveStoredNotebookSourceFile = vi.fn();
const mockPersistNotebookAttachment = vi.fn();
const mockAddNotebookAttachmentsToPage = vi.fn();
const mockResolveNotebookAttachmentFile = vi.fn();
const mockDeleteNotebookAttachmentFile = vi.fn();
const mockRemoveNotebookAttachmentFromPage = vi.fn();

vi.mock('../../../utils/dbSchema.js', () => ({
  getTableColumns: (...args: unknown[]) => mockGetTableColumns(...args),
}));

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

vi.mock('../../../services/notebookService.js', () => ({
  default: {
    capture: (...args: unknown[]) => mockNotebookCapture(...args),
    createAIProposal: (...args: unknown[]) => mockCreateAIProposal(...args),
    getProposalsForPage: (...args: unknown[]) => mockGetProposalsForPage(...args),
    resolveAIProposal: (...args: unknown[]) => mockResolveAIProposal(...args),
  },
}));

vi.mock('../../../services/notebookConversionService.js', () => ({
  convertNotebookPage: (...args: unknown[]) => mockConvertNotebookPage(...args),
  NotebookConversionError: class NotebookConversionError extends Error {
    status: number;
    code?: string;
    constructor(status: number, message: string, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

vi.mock('../../../services/notebookSourceFileService.js', () => ({
  resolveStoredNotebookSourceFile: (...args: unknown[]) =>
    mockResolveStoredNotebookSourceFile(...args),
  toPublicNotebookCaptureMetadata: (raw: string | null | undefined) => {
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const { sourceFileStorageKey: _internal, ...publicMetadata } = parsed;
    return publicMetadata;
  },
}));

vi.mock('../../../services/notebookAttachmentService.js', () => ({
  persistNotebookAttachment: (...args: unknown[]) => mockPersistNotebookAttachment(...args),
  addNotebookAttachmentsToPage: (...args: unknown[]) => mockAddNotebookAttachmentsToPage(...args),
  resolveNotebookAttachmentFile: (...args: unknown[]) => mockResolveNotebookAttachmentFile(...args),
  deleteNotebookAttachmentFile: (...args: unknown[]) => mockDeleteNotebookAttachmentFile(...args),
  removeNotebookAttachmentFromPage: (...args: unknown[]) =>
    mockRemoveNotebookAttachmentFromPage(...args),
  NotebookAttachmentMutationError: class NotebookAttachmentMutationError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  parseNotebookAttachments: (raw: string | null | undefined) => (raw ? JSON.parse(raw) : []),
  toPublicNotebookAttachments: (raw: string | null | undefined) =>
    (raw ? JSON.parse(raw) : []).map(
      ({ storageKey: _storageKey, ...attachment }: any) => attachment
    ),
}));

import myWorkRoutes from '../my-work.routes.js';

const ORG = 'org-notebook-v8';
const USER_ID = 'user-notebook-v8';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.v8Context = {
      organizationId: ORG,
      userId: USER_ID,
      userRole: 'ADMIN',
      isSuperAdmin: false,
    };
    next();
  });
  app.use('/api/v8/my-work', myWorkRoutes);
  return app;
}

describe('V8 My Work notebook routes', () => {
  beforeEach(() => {
    // `clearAllMocks` keeps queued `mockResolvedValueOnce` implementations.
    // This route suite relies on ordered DB reads, so a short-circuited request
    // must not leak its unused queue into the next test.
    [
      mockGetTableColumns,
      mockQueryAll,
      mockQueryOne,
      mockQueryRun,
      mockCreateAIProposal,
      mockGetProposalsForPage,
      mockResolveAIProposal,
      mockConvertNotebookPage,
      mockNotebookCapture,
      mockResolveStoredNotebookSourceFile,
      mockPersistNotebookAttachment,
      mockAddNotebookAttachmentsToPage,
      mockResolveNotebookAttachmentFile,
      mockDeleteNotebookAttachmentFile,
      mockRemoveNotebookAttachmentFromPage,
    ].forEach((mock) => mock.mockReset());
    mockGetTableColumns.mockResolvedValue(new Map([['id', { name: 'id' }]]));
    mockQueryAll.mockResolvedValue([]);
    mockQueryOne.mockResolvedValue(null);
    mockQueryRun.mockResolvedValue({});
  });

  it('lists notebook pages through the V8 envelope', async () => {
    mockQueryAll.mockResolvedValue([
      {
        id: 'note-1',
        ownerUserId: USER_ID,
        organizationId: ORG,
        projectId: null,
        visibility: 'private',
        title: 'Notebook item',
        contentJson: JSON.stringify({ type: 'doc', content: [] }),
        contentText: 'content',
        tags: '["alpha"]',
        maturity: 'seed',
        icon: null,
        summary: null,
        status: 'converted',
        pinned: 0,
        verificationStatus: 'unverified',
        reviewCadence: 'monthly',
        staleAt: null,
        lastReviewedAt: null,
        captureSource: 'upload',
        captureMetadataJson: JSON.stringify({
          fileOriginalname: 'board-notes.pdf',
          fileMimetype: 'application/pdf',
          storedSourceFile: true,
          sourceFileStorageKey: 'org-hidden/note.pdf',
        }),
        attachmentsJson: JSON.stringify([
          {
            id: 'att-1',
            name: 'notes.png',
            type: 'image/png',
            size: 1200,
            uploadedAt: '2026-03-26T10:00:00.000Z',
            storageKey: 'org-hidden/notes.png',
          },
        ]),
        convertedToJson: null,
        createdAt: '2026-03-26T10:00:00.000Z',
        updatedAt: '2026-03-26T10:00:00.000Z',
      },
    ]);

    const res = await request(createApp())
      .get('/api/v8/my-work/notebook/pages')
      .query({ status: 'active', limit: '10', pinned: '0' });

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ version: 'v8', contract: 'my_work_notebook_v1' });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: 'note-1',
      title: 'Notebook item',
      tags: ['alpha'],
      pinned: false,
      captureSource: 'upload',
      captureMetadata: {
        fileOriginalname: 'board-notes.pdf',
        fileMimetype: 'application/pdf',
        storedSourceFile: true,
      },
      attachments: [
        {
          id: 'att-1',
          name: 'notes.png',
          type: 'image/png',
          size: 1200,
          uploadedAt: '2026-03-26T10:00:00.000Z',
        },
      ],
    });
    expect(res.body.data[0].captureMetadata.sourceFileStorageKey).toBeUndefined();
    expect(res.body.data[0].attachments[0].storageKey).toBeUndefined();
  });

  it('lists notebook pages even when optional notebook columns are missing', async () => {
    mockGetTableColumns.mockResolvedValue(
      new Map(
        [
          'id',
          'owner_user_id',
          'organization_id',
          'project_id',
          'visibility',
          'title',
          'content_json',
          'content_text',
          'tags_json',
          'created_at',
          'updated_at',
        ].map((name) => [name, { name }])
      )
    );

    mockQueryAll.mockResolvedValue([
      {
        id: 'note-legacy-1',
        ownerUserId: USER_ID,
        organizationId: ORG,
        projectId: null,
        visibility: 'private',
        title: 'Legacy notebook item',
        contentJson: JSON.stringify({ type: 'doc', content: [] }),
        contentText: 'legacy content',
        tags: '["legacy"]',
        status: 'active',
        pinned: 0,
        createdAt: '2026-03-26T10:00:00.000Z',
        updatedAt: '2026-03-26T10:00:00.000Z',
      },
    ]);

    const res = await request(createApp()).get('/api/v8/my-work/notebook/pages');

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      id: 'note-legacy-1',
      title: 'Legacy notebook item',
      tags: ['legacy'],
      captureSource: null,
      captureMetadata: null,
      attachments: [],
      convertedTo: null,
      verificationStatus: 'unverified',
      reviewCadence: 'monthly',
      pinned: false,
    });

    const executedSql = String(mockQueryAll.mock.calls[0]?.[0] || '');
    expect(executedSql).not.toContain('np.capture_source');
    expect(executedSql).not.toContain('np.attachments_json');
    expect(executedSql).not.toContain('np.converted_to_json');
  });

  it('creates a notebook page through the V8 namespace', async () => {
    mockQueryRun.mockResolvedValue({});
    mockQueryOne.mockResolvedValue({
      id: 'note-2',
      ownerUserId: USER_ID,
      organizationId: ORG,
      projectId: null,
      visibility: 'private',
      title: 'Fresh note',
      contentJson: JSON.stringify({ type: 'doc', content: [] }),
      contentText: null,
      tags: '[]',
      maturity: 'seed',
      icon: null,
      summary: null,
      status: 'active',
      pinned: 0,
      verificationStatus: 'unverified',
      reviewCadence: 'monthly',
      staleAt: null,
      lastReviewedAt: null,
      convertedToJson: null,
      createdAt: '2026-03-26T10:00:00.000Z',
      updatedAt: '2026-03-26T10:00:00.000Z',
    });

    const res = await request(createApp())
      .post('/api/v8/my-work/notebook/pages')
      .send({
        title: 'Fresh note',
        contentJson: { type: 'doc', content: [] },
      });

    expect(res.status).toBe(201);
    expect(res.body.meta.contract).toBe('my_work_notebook_v1');
    expect(mockQueryRun).toHaveBeenCalled();
    expect(res.body.data.title).toBe('Fresh note');
  });

  it('routes notebook capture upload through the V8 namespace', async () => {
    mockNotebookCapture.mockResolvedValue({
      pageId: 'captured-v8-note-1',
      source: 'upload',
    });

    const res = await request(createApp())
      .post('/api/v8/my-work/notebook/capture/upload')
      .attach('file', Buffer.from('hello world'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      });

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.meta).toEqual({ version: 'v8', contract: 'my_work_notebook_v1' });
    expect(res.body.data).toEqual({
      pageId: 'captured-v8-note-1',
      source: 'upload',
    });
    expect(mockNotebookCapture).toHaveBeenCalledWith(ORG, USER_ID, {
      source: 'upload',
      title: undefined,
      fileBuffer: expect.any(Buffer),
      fileMimetype: 'text/plain',
      fileOriginalname: 'note.txt',
      tags: [],
      projectId: undefined,
    });
  });

  it('downloads stored notebook source files through the V8 namespace', async () => {
    const tmpFile = path.join(os.tmpdir(), `notebook-source-${Date.now()}.txt`);
    await fs.writeFile(tmpFile, 'hello world', 'utf8');
    mockQueryOne.mockResolvedValue({
      id: 'note-download-1',
      ownerUserId: USER_ID,
      organizationId: ORG,
      projectId: null,
      visibility: 'private',
      captureSource: 'upload',
      captureMetadataJson: JSON.stringify({
        fileOriginalname: 'note.txt',
        fileMimetype: 'text/plain',
        storedSourceFile: true,
        sourceFileStorageKey: 'org/note.txt',
      }),
    });
    mockResolveStoredNotebookSourceFile.mockResolvedValue({
      filePath: tmpFile,
      fileName: 'note.txt',
      mimeType: 'text/plain',
      sizeBytes: 11,
    });

    const res = await request(createApp()).get(
      '/api/v8/my-work/notebook/pages/note-download-1/source-file'
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toBe('hello world');

    await fs.unlink(tmpFile).catch(() => undefined);
  });

  it('uploads notebook attachments through the V8 namespace', async () => {
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'note-attach-1',
        owner_user_id: USER_ID,
        organization_id: ORG,
        attachmentsJson: JSON.stringify([]),
      })
      .mockResolvedValueOnce({
        id: 'note-attach-1',
        ownerUserId: USER_ID,
        organizationId: ORG,
        projectId: null,
        visibility: 'private',
        title: 'Attachment note',
        contentJson: JSON.stringify({ type: 'doc', content: [] }),
        contentText: 'content',
        tags: '[]',
        maturity: 'seed',
        icon: null,
        summary: null,
        status: 'active',
        pinned: 0,
        verificationStatus: 'unverified',
        reviewCadence: 'monthly',
        staleAt: null,
        lastReviewedAt: null,
        captureSource: null,
        captureMetadataJson: null,
        attachmentsJson: JSON.stringify([
          {
            id: 'att-v8-1',
            name: 'brief.pdf',
            type: 'application/pdf',
            size: 11,
            uploadedAt: '2026-03-28T10:00:00.000Z',
            storageKey: 'org/note/brief.pdf',
          },
        ]),
        convertedToJson: null,
        createdAt: '2026-03-26T10:00:00.000Z',
        updatedAt: '2026-03-28T10:00:00.000Z',
      });
    mockAddNotebookAttachmentsToPage.mockResolvedValue([
      {
        id: 'att-v8-1',
        name: 'brief.pdf',
        type: 'application/pdf',
        size: 11,
        uploadedAt: '2026-03-28T10:00:00.000Z',
        storageKey: 'org/note/brief.pdf',
      },
    ]);

    const res = await request(createApp())
      .post('/api/v8/my-work/notebook/pages/note-attach-1/attachments')
      .attach('files', Buffer.from('hello world'), {
        filename: 'brief.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(mockAddNotebookAttachmentsToPage).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG,
        pageId: 'note-attach-1',
        files: [
          expect.objectContaining({
            originalname: 'brief.pdf',
          }),
        ],
      })
    );
    expect(res.body.data.attachments).toEqual([
      expect.objectContaining({
        id: 'att-v8-1',
        name: 'brief.pdf',
        type: 'application/pdf',
      }),
    ]);
  });

  it('downloads notebook attachments through the V8 namespace', async () => {
    const tmpFile = path.join(os.tmpdir(), `notebook-attachment-${Date.now()}.txt`);
    await fs.writeFile(tmpFile, 'attachment body', 'utf8');
    mockQueryOne.mockResolvedValue({
      id: 'note-download-2',
      ownerUserId: USER_ID,
      organizationId: ORG,
      projectId: null,
      visibility: 'private',
      attachmentsJson: JSON.stringify([
        {
          id: 'att-2',
          name: 'attachment.txt',
          type: 'text/plain',
          size: 15,
          storageKey: 'org/attachment.txt',
        },
      ]),
    });
    mockResolveNotebookAttachmentFile.mockResolvedValue({
      filePath: tmpFile,
      fileName: 'attachment.txt',
      mimeType: 'text/plain',
      sizeBytes: 15,
    });

    const res = await request(createApp()).get(
      '/api/v8/my-work/notebook/pages/note-download-2/attachments/att-2/download'
    );

    expect(res.status).toBe(200);
    expect(res.text).toBe('attachment body');

    await fs.unlink(tmpFile).catch(() => undefined);
  });

  it('deletes notebook attachments through the V8 namespace', async () => {
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'note-attach-2',
        owner_user_id: USER_ID,
        organization_id: ORG,
        attachmentsJson: JSON.stringify([
          {
            id: 'att-delete-1',
            name: 'remove.txt',
            type: 'text/plain',
            size: 7,
            storageKey: 'org/remove.txt',
          },
        ]),
      })
      .mockResolvedValueOnce({
        id: 'note-attach-2',
        ownerUserId: USER_ID,
        organizationId: ORG,
        projectId: null,
        visibility: 'private',
        title: 'Attachment note',
        contentJson: JSON.stringify({ type: 'doc', content: [] }),
        contentText: 'content',
        tags: '[]',
        maturity: 'seed',
        icon: null,
        summary: null,
        status: 'active',
        pinned: 0,
        verificationStatus: 'unverified',
        reviewCadence: 'monthly',
        staleAt: null,
        lastReviewedAt: null,
        captureSource: null,
        captureMetadataJson: null,
        attachmentsJson: JSON.stringify([]),
        convertedToJson: null,
        createdAt: '2026-03-26T10:00:00.000Z',
        updatedAt: '2026-03-28T10:00:00.000Z',
      });
    mockRemoveNotebookAttachmentFromPage.mockResolvedValue([]);

    const res = await request(createApp()).delete(
      '/api/v8/my-work/notebook/pages/note-attach-2/attachments/att-delete-1'
    );

    expect(res.status).toBe(200);
    expect(mockRemoveNotebookAttachmentFromPage).toHaveBeenCalledWith({
      pageId: 'note-attach-2',
      attachmentId: 'att-delete-1',
    });
    expect(res.body.data.attachments).toEqual([]);
  });

  it('updates an owned notebook page through the V8 namespace', async () => {
    mockGetTableColumns.mockResolvedValue(
      new Map(
        [
          'id',
          'owner_user_id',
          'organization_id',
          'project_id',
          'visibility',
          'title',
          'content_json',
          'content_text',
          'tags_json',
          'maturity',
          'icon',
          'summary',
          'status',
          'pinned',
          'verification_status',
          'review_cadence',
          'stale_at',
          'last_reviewed_at',
          'converted_to_json',
          'created_at',
          'updated_at',
        ].map((name) => [name, { name }])
      )
    );

    mockQueryOne
      .mockResolvedValueOnce({
        id: 'note-3',
        owner_user_id: USER_ID,
        organization_id: ORG,
        project_id: null,
        visibility: 'private',
      })
      .mockResolvedValueOnce({
        id: 'note-3',
        ownerUserId: USER_ID,
        organizationId: ORG,
        projectId: null,
        visibility: 'private',
        title: 'Updated title',
        contentJson: JSON.stringify({ type: 'doc', content: [] }),
        contentText: 'updated',
        tags: '["beta"]',
        maturity: 'mature',
        icon: null,
        summary: 'summary',
        status: 'converted',
        pinned: 1,
        verificationStatus: 'verified',
        reviewCadence: 'monthly',
        staleAt: null,
        lastReviewedAt: null,
        convertedToJson: JSON.stringify([{ type: 'report', id: 'report-1' }]),
        createdAt: '2026-03-26T10:00:00.000Z',
        updatedAt: '2026-03-26T10:05:00.000Z',
      });

    const res = await request(createApp())
      .put('/api/v8/my-work/notebook/pages/note-3')
      .send({
        title: 'Updated title',
        contentText: 'updated',
        tags: ['beta'],
        status: 'converted',
        convertedTo: [{ type: 'report', id: 'report-1' }],
      });

    expect(res.status).toBe(200);
    expect(mockQueryRun).toHaveBeenCalled();
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('converted_to_json = ?'),
      expect.arrayContaining([JSON.stringify([{ type: 'report', id: 'report-1' }])])
    );
    expect(res.body.data).toMatchObject({
      id: 'note-3',
      title: 'Updated title',
      tags: ['beta'],
      pinned: true,
      status: 'converted',
      convertedTo: [{ type: 'report', id: 'report-1' }],
    });
  });

  it('updates notebook status through the V8 namespace', async () => {
    mockQueryOne.mockResolvedValue({
      id: 'note-4',
      owner_user_id: USER_ID,
      organization_id: ORG,
    });
    mockQueryRun.mockResolvedValue({});

    const res = await request(createApp())
      .put('/api/v8/my-work/notebook/pages/note-4/status')
      .send({ status: 'archived' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 'note-4', status: 'archived' });
  });

  it('classifies an owned notebook page through the V8 namespace', async () => {
    mockQueryOne.mockResolvedValue({
      id: 'note-4b',
      title: 'New idea concept',
      contentText: 'brainstorm and explore a fresh idea concept',
      maturity: 'mature',
    });

    const res = await request(createApp()).post('/api/v8/my-work/notebook/pages/note-4b/classify');

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ version: 'v8', contract: 'my_work_notebook_v1' });
    expect(res.body.data).toMatchObject({
      pageId: 'note-4b',
      suggestedType: 'idea',
      reason: 'Contains exploratory/idea language',
      maturity: 'mature',
      // L-06: contract declares the suggestion is rule-based, not an LLM.
      method: 'heuristic',
    });
  });

  it('creates notebook AI proposals through the V8 namespace', async () => {
    mockCreateAIProposal.mockResolvedValue({
      id: 'proposal-1',
      pageId: 'note-4b',
      actorId: USER_ID,
      proposalType: 'append',
      blockContent: { type: 'paragraph' },
      rationale: 'Add summary',
      status: 'proposed',
    });

    const res = await request(createApp())
      .post('/api/v8/my-work/notebook/pages/note-4b/ai-proposals')
      .send({
        proposalType: 'append',
        blockContent: { type: 'paragraph' },
        rationale: 'Add summary',
      });

    expect(res.status).toBe(201);
    expect(res.body.meta).toEqual({ version: 'v8', contract: 'my_work_notebook_v1' });
    expect(mockCreateAIProposal).toHaveBeenCalledWith(ORG, USER_ID, 'note-4b', {
      proposalType: 'append',
      blockContent: { type: 'paragraph' },
      rationale: 'Add summary',
    });
    expect(res.body.data.status).toBe('proposed');
  });

  it('converts notebook pages through the governed V8 namespace', async () => {
    mockConvertNotebookPage.mockResolvedValue({
      id: 'initiative-7',
      type: 'initiative',
      title: 'Converted initiative',
      sourceSessionId: 'tool-9',
    });

    const res = await request(createApp())
      .post('/api/v8/my-work/notebook/pages/note-4b/convert')
      .send({
        target: 'initiative',
        title: 'Converted initiative',
        description: 'Notebook summary',
      });

    expect(res.status).toBe(201);
    expect(res.body.meta).toEqual({ version: 'v8', contract: 'my_work_notebook_v1' });
    expect(mockConvertNotebookPage).toHaveBeenCalledWith({
      pageId: 'note-4b',
      orgId: ORG,
      userId: USER_ID,
      target: 'initiative',
      title: 'Converted initiative',
      description: 'Notebook summary',
      assessmentType: undefined,
    });
    expect(res.body.data).toMatchObject({
      id: 'initiative-7',
      type: 'initiative',
      sourceSessionId: 'tool-9',
    });
  });

  it('lists notebook AI proposals through the V8 namespace', async () => {
    mockGetProposalsForPage.mockResolvedValue([
      {
        id: 'proposal-1',
        pageId: 'note-4b',
        actorId: USER_ID,
        proposalType: 'append',
        blockContent: { type: 'paragraph' },
        rationale: 'Add summary',
        status: 'proposed',
      },
    ]);

    const res = await request(createApp())
      .get('/api/v8/my-work/notebook/pages/note-4b/ai-proposals')
      .query({ status: 'proposed', limit: '20' });

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ version: 'v8', contract: 'my_work_notebook_v1' });
    expect(mockGetProposalsForPage).toHaveBeenCalledWith(ORG, 'note-4b', {
      status: 'proposed',
      limit: 20,
    });
    expect(res.body.data.proposals).toHaveLength(1);
  });

  it('resolves notebook AI proposals through the V8 namespace', async () => {
    mockResolveAIProposal.mockResolvedValue({
      id: 'proposal-1',
      pageId: 'note-4b',
      actorId: USER_ID,
      proposalType: 'append',
      blockContent: { type: 'paragraph' },
      rationale: 'Add summary',
      status: 'accepted',
    });

    const res = await request(createApp())
      .post('/api/v8/my-work/notebook/ai-proposals/proposal-1/resolve')
      .send({ action: 'accepted' });

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ version: 'v8', contract: 'my_work_notebook_v1' });
    expect(mockResolveAIProposal).toHaveBeenCalledWith(ORG, 'proposal-1', USER_ID, 'accepted');
    expect(res.body.data.status).toBe('accepted');
  });

  it('deletes an owned notebook page through the V8 namespace', async () => {
    mockQueryOne.mockResolvedValue({
      id: 'note-5',
      owner_user_id: USER_ID,
      organization_id: ORG,
    });
    mockQueryRun.mockResolvedValue({});

    const res = await request(createApp()).delete('/api/v8/my-work/notebook/pages/note-5');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ success: true, id: 'note-5' });
  });
});
