import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    req.user = { id: 'user-1', organizationId: 'org-1' };
    next();
  },
}));

const dbGetMock = vi.fn();
const dbAllMock = vi.fn();
const dbRunMock = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGetMock(...args),
  all: (...args: any[]) => dbAllMock(...args),
  run: (...args: any[]) => dbRunMock(...args),
}));

const tableColumns: Record<string, string[]> = {
  my_ideas: [
    'id',
    'user_id',
    'organization_id',
    'title',
    'body',
    'seed_text',
    'stage',
    'source_type',
    'source_conversation_id',
    'source_message_id',
    'created_at',
    'updated_at',
  ],
  my_idea_maps: [
    'id',
    'idea_id',
    'user_id',
    'organization_id',
    'nodes_json',
    'edges_json',
    'schema_version',
    'extensions_json',
    'created_at',
    'updated_at',
  ],
  notebook_pages: [
    'id',
    'owner_user_id',
    'organization_id',
    'visibility',
    'title',
    'content_json',
    'content_text',
    'tags_json',
    'status',
    'capture_source',
    'capture_metadata',
    'created_at',
    'updated_at',
  ],
  initiatives: [
    'id',
    'organization_id',
    'created_by',
    'name',
    'summary',
    'status',
    'source_type',
    'source_id',
    'created_at',
    'updated_at',
  ],
  presentation_decks: [
    'id',
    'organization_id',
    'created_by',
    'title',
    'deck_type',
    'theme',
    'slide_count',
    'status',
    'source_id',
    'source_refs_json',
    'created_at',
    'updated_at',
  ],
  presentation_cards: [
    'id',
    'deck_id',
    'card_index',
    'intent',
    'blocks_json',
    'created_at',
    'updated_at',
  ],
};

vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: (table: string) => new Set(tableColumns[table] || ['id']),
}));

import workCanvasRouter from '../../../server/src/routes/work-canvas.routes.js';

const draftRow = {
  id: 'draft-1',
  organization_id: 'org-1',
  created_by: 'user-1',
  conversation_id: 'conv-1',
  kind: 'document',
  title: 'Canvas Strategy',
  content_json: JSON.stringify('# Canvas Strategy\n\n## Context\n\nBuild the operating workspace.'),
  canonical_format: 'markdown',
  content_md: '# Canvas Strategy\n\n## Context\n\nBuild the operating workspace.',
  content_json_native: null,
  content_schema_version: null,
  markdown_projection_status: 'synced',
  markdown_projected_at: null,
  projection_error: null,
  sources_json: '[]',
  provenance_json: '{}',
  project_id: null,
  owner_id: 'user-1',
  research_session_id: null,
  artifact_id: null,
  artifact_run_id: null,
  artifact_version: null,
  save_state: 'saved',
  lifecycle_state: 'draft',
  dirty_state: 'clean',
  visibility: 'private',
  audit_status: 'not_required',
  created_at: '2026-05-03T00:00:00.000Z',
  updated_at: '2026-05-03T00:00:00.000Z',
};

describe('work canvas routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/work-canvas', workCanvasRouter);

  beforeEach(() => {
    vi.clearAllMocks();
    dbGetMock.mockResolvedValue(draftRow);
    dbAllMock.mockResolvedValue([]);
    dbRunMock.mockResolvedValue({ changes: 1 });
  });

  it('saves a Canvas draft to a workspace idea with read-back', async () => {
    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/save-to-workspace')
      .send({ target: 'idea' })
      .expect(200);

    expect(response.body.data.linkedResource.type).toBe('idea');
    expect(response.body.data.readBack.status).toBe('created');
    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO my_ideas'),
      expect.any(Array),
      expect.any(Object)
    );
    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO work_canvas_versions'),
      expect.any(Array),
      expect.any(Object)
    );
  });

  it('creates a presentation output from a Canvas draft', async () => {
    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/create-output')
      .send({ outputType: 'presentation' })
      .expect(200);

    expect(response.body.data.outputResource.type).toBe('presentation');
    expect(response.body.data.readBack.status).toBe('created');
    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO presentation_decks'),
      expect.any(Array),
      expect.any(Object)
    );
    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO presentation_cards'),
      expect.any(Array),
      expect.any(Object)
    );
  });

  it('applies replace_selection operation with a version snapshot and diff', async () => {
    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/operations')
      .send({
        operation: {
          type: 'replace_selection',
          selectedText: 'Build the operating workspace.',
          replacementMd: 'Build the operating workspace with selected context.',
        },
      })
      .expect(200);

    expect(response.body.data.draft.contentMd).toContain('selected context');
    expect(response.body.data.version.operationType).toBe('replace_selection');
    expect(response.body.data.diff.summary).toContain('lines added');
    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO work_canvas_versions'),
      expect.any(Array),
      expect.any(Object)
    );
    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE work_canvas_drafts'),
      expect.any(Array),
      expect.any(Object)
    );
  });

  it('appends a Canvas section through the operations endpoint', async () => {
    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/operations')
      .send({
        operation: {
          type: 'append_section',
          heading: 'Next Steps',
          contentMd: '- Wire autosave',
        },
      })
      .expect(200);

    expect(response.body.data.draft.contentMd).toContain('## Next Steps');
    expect(response.body.data.draft.contentMd).toContain('- Wire autosave');
    expect(response.body.data.version.operationType).toBe('append_section');
  });

  it('creates a share token on the Canvas draft provenance', async () => {
    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/share')
      .send({})
      .expect(200);

    expect(response.body.data.share.token).toEqual(expect.any(String));
    expect(response.body.data.share.url).toContain('/work-canvas/shared/');
    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE work_canvas_drafts'),
      expect.arrayContaining([expect.stringContaining('"share"')]),
      expect.any(Object)
    );
  });
});
