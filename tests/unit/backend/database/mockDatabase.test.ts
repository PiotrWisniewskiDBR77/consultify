import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getDatabase, resetConnection } from '../../../../server/src/database/Database.ts';
import { clearSchemaCache, getTableColumns } from '../../../../server/src/utils/dbSchema.ts';

describe('mock Database', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalMockDb = process.env.MOCK_DB;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'true';
    clearSchemaCache();
    await resetConnection();
  });

  afterEach(async () => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;

    if (originalMockDb === undefined) delete process.env.MOCK_DB;
    else process.env.MOCK_DB = originalMockDb;

    await resetConnection();
    clearSchemaCache();
  });

  it('updates and reads my_idea_maps rows by composite key with select aliases', async () => {
    const db = getDatabase();

    await db.run(
      `CREATE TABLE my_idea_maps (
        id TEXT PRIMARY KEY,
        idea_id TEXT,
        user_id TEXT,
        organization_id TEXT,
        nodes_json TEXT,
        edges_json TEXT,
        extensions_json TEXT,
        version INTEGER,
        updated_at TEXT
      )`
    );

    await db.run(
      `INSERT INTO my_idea_maps (
        id, idea_id, user_id, organization_id, nodes_json, edges_json, extensions_json, version, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'map-1',
        'idea-1',
        'user-1',
        'org-1',
        JSON.stringify([{ id: 'root' }]),
        JSON.stringify([]),
        JSON.stringify({}),
        1,
        '2026-03-15T00:00:00.000Z',
      ]
    );

    const updatedNodes = JSON.stringify([{ id: 'root' }, { id: 'node-1' }]);
    const updatedEdges = JSON.stringify([{ id: 'edge-1', source: 'root', target: 'node-1' }]);

    await db.run(
      `UPDATE my_idea_maps
       SET nodes_json = ?, edges_json = ?, version = ?, updated_at = ?
       WHERE idea_id = ? AND user_id = ? AND organization_id = ?`,
      [updatedNodes, updatedEdges, 2, '2026-03-15T12:00:00.000Z', 'idea-1', 'user-1', 'org-1']
    );

    const row = await db.get(
      `SELECT id, nodes_json as "nodesJson", edges_json as "edgesJson", version, updated_at as "updatedAt"
       FROM my_idea_maps
       WHERE idea_id = ? AND user_id = ? AND organization_id = ?
       LIMIT 1`,
      ['idea-1', 'user-1', 'org-1']
    );

    expect(row).toMatchObject({
      id: 'map-1',
      nodesJson: updatedNodes,
      edgesJson: updatedEdges,
      version: 2,
      updatedAt: '2026-03-15T12:00:00.000Z',
    });
  });

  it('reads mock table columns through dbSchema helper', async () => {
    const db = getDatabase();

    await db.run(
      `CREATE TABLE my_idea_maps (
        id TEXT PRIMARY KEY,
        idea_id TEXT,
        user_id TEXT,
        organization_id TEXT,
        nodes_json TEXT,
        edges_json TEXT,
        version INTEGER
      )`
    );

    const cols = await getTableColumns('my_idea_maps');

    expect(cols.has('id')).toBe(true);
    expect(cols.has('idea_id')).toBe(true);
    expect(cols.has('nodes_json')).toBe(true);
    expect(cols.has('edges_json')).toBe(true);
    expect(cols.has('version')).toBe(true);
  });

  it('reports zero changes and preserves the row when optimistic version does not match', async () => {
    const db = getDatabase();

    await db.run(
      `CREATE TABLE presentation_decks (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        title TEXT,
        deck_json TEXT,
        version INTEGER
      )`
    );
    await db.run(
      `INSERT INTO presentation_decks (id, organization_id, title, deck_json, version)
       VALUES (?, ?, ?, ?, ?)`,
      ['deck-1', 'org-1', 'Original', '{"title":"Original"}', 1]
    );

    const result = await db.run(
      `UPDATE presentation_decks
       SET title = ?, deck_json = ?, version = ?
       WHERE id = ? AND organization_id = ? AND version = ?`,
      ['Changed', '{"title":"Changed"}', 2, 'deck-1', 'org-1', 9]
    );

    expect(result.changes).toBe(0);
    expect(
      await db.get(
        `SELECT title, deck_json, version FROM presentation_decks
         WHERE id = ? AND organization_id = ?`,
        ['deck-1', 'org-1']
      )
    ).toMatchObject({ title: 'Original', deck_json: '{"title":"Original"}', version: 1 });
  });

  it('exposes the personal-task write/read contract when the mock table has no schema', async () => {
    const cols = await getTableColumns('tasks');

    expect(cols).toEqual(
      expect.objectContaining(
        new Set([
          'id',
          'organization_id',
          'title',
          'description',
          'status',
          'priority',
          'assignee_id',
          'reporter_id',
          'due_date',
          'tags',
          'task_type',
          'source_type',
          'source_id',
          'created_at',
          'updated_at',
          'completed_at',
        ])
      )
    );
  });
});
