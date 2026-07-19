/**
 * J26 — Doktryna dwóch kanałów, kanał 2 („edytor z podręcznym AI").
 * Domknięcie luk S: Notatnik (AI-replace fragmentu) + Mind Map (rename węzła
 * przez ścieżkę Propose→Accept).
 *
 * Wzorzec 1:1 z docs-teresa.e2e.test.ts: REALNY router (legacy notebook) +
 * REALNE auth (minted JWT + verifyToken) + REALNA lokalna/parity Postgres.
 * Zero mocków logiki biznesowej. Prefiks izolacji `odbior--j26s--`.
 *
 * Uwaga: sam mechanizm renameu w Mind Mapie jest CZYSTĄ funkcją kliencką
 * (`applyAIProposalRuntime` — updateNodes patch), więc testujemy go wprost
 * (bez DB/LLM), zgodnie z „możesz wołać serwis bezpośrednio jeśli router
 * czatowy za ciężki".
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { applyAIProposalRuntime } from '../../src/components/MyWork/aiProposalRuntime.js';
import type { AIProposal } from '../../src/components/MyWork/ideaSelectionTypes.js';
import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--j26s--';
const createdPageIds: string[] = [];

let token: string;
let app: Express;

/** Insert a notebook page directly with a known 3-block document. */
async function insertPage(id: string, blocks: string[]): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    const doc = {
      type: 'doc',
      content: blocks.map((text) => ({
        type: 'paragraph',
        content: [{ type: 'text', text }],
      })),
    };
    await client.query(
      `INSERT INTO notebook_pages
         (id, owner_user_id, organization_id, title, content_json, content_text, visibility, maturity, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'private', 'seed', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET content_json = EXCLUDED.content_json, content_text = EXCLUDED.content_text`,
      [id, SEED.USER_ID, SEED.ORG_ID, `${PREFIX}note`, JSON.stringify(doc), blocks.join('\n\n')]
    );
    createdPageIds.push(id);
  } finally {
    await client.end();
  }
}

async function readBlocks(id: string): Promise<Array<{ text: string }>> {
  const client = pgClient();
  await client.connect();
  try {
    const r = await client.query(
      `SELECT content_json FROM notebook_pages WHERE id = $1 AND organization_id = $2`,
      [id, SEED.ORG_ID]
    );
    const doc = JSON.parse(r.rows[0].content_json);
    return (doc.content as Array<Record<string, any>>).map((b) => ({
      text: (b.content?.[0]?.text as string) ?? '',
    }));
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  await seed(); // idempotent — org/user/membership odbioru
  token = mintToken();

  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { default: notebookRouter } = await import('../../server/src/routes/notebook.routes.js');
  app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/notebook', verifyToken as any, notebookRouter);
}, 60_000);

afterAll(async () => {
  if (createdPageIds.length) {
    const client = pgClient();
    await client.connect();
    try {
      await client
        .query('DELETE FROM notebook_ai_proposals WHERE page_id = ANY($1)', [createdPageIds])
        .catch(() => {});
      await client.query('DELETE FROM notebook_pages WHERE id = ANY($1)', [createdPageIds]);
    } finally {
      await client.end();
    }
  }
});

describe('J26 kanał 2 — Notatnik: AI-replace FRAGMENTU (nie append)', () => {
  it('replace z _replaceRange podmienia TYLKO wskazany blok, zachowując sąsiadów', async () => {
    const pageId = `${PREFIX}page-fragment`;
    await insertPage(pageId, [
      'Alpha first paragraph',
      'Beta middle paragraph',
      'Gamma third paragraph',
    ]);

    // Create a REPLACE proposal targeting block index 1 only.
    const createRes = await request(app)
      .post(`/api/notebook/pages/${pageId}/ai-proposals`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        proposalType: 'replace',
        rationale: 'popraw fragment',
        blockContent: {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Beta REVISED paragraph' }],
          _replaceRange: { from: 1, to: 1 },
          _replaceBlocks: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Beta REVISED paragraph' }] },
          ],
        },
      });
    expect(createRes.status).toBe(201);
    const proposalId = createRes.body?.id ?? createRes.body?.data?.id;
    expect(proposalId).toBeTruthy();

    // Accept it.
    const resolveRes = await request(app)
      .post(`/api/notebook/ai-proposals/${proposalId}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'accepted' });
    expect(resolveRes.status).toBe(200);

    // Assert: exactly the middle block changed; siblings preserved; count unchanged.
    const blocks = await readBlocks(pageId);
    expect(blocks.length).toBe(3); // NOT 4 (append) and NOT 1 (whole-doc replace)
    expect(blocks[0].text).toBe('Alpha first paragraph');
    expect(blocks[1].text).toBe('Beta REVISED paragraph');
    expect(blocks[2].text).toBe('Gamma third paragraph');
  });

  it('replace BEZ metadanych zachowuje starą semantykę całodokumentową (kompatybilność wsteczna)', async () => {
    const pageId = `${PREFIX}page-wholedoc`;
    await insertPage(pageId, ['One', 'Two', 'Three']);

    const createRes = await request(app)
      .post(`/api/notebook/pages/${pageId}/ai-proposals`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        proposalType: 'replace',
        rationale: 'zastąp cały dokument',
        blockContent: { type: 'paragraph', content: [{ type: 'text', text: 'Only block now' }] },
      });
    expect(createRes.status).toBe(201);
    const proposalId = createRes.body?.id ?? createRes.body?.data?.id;

    await request(app)
      .post(`/api/notebook/ai-proposals/${proposalId}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'accepted' })
      .expect(200);

    const blocks = await readBlocks(pageId);
    expect(blocks.length).toBe(1);
    expect(blocks[0].text).toBe('Only block now');
  });
});

describe('J26 kanał 2 — Mind Map: rename węzła przez Propose→Accept', () => {
  it('updateNodes patch MODYFIKUJE etykietę istniejącego węzła (nie dodaje nowego)', () => {
    const nodes = [
      { id: 'root', type: 'idea', data: { label: 'Central topic' }, position: { x: 0, y: 0 } },
      { id: 'n1', type: 'idea', data: { label: 'Original label' }, position: { x: 100, y: 0 } },
      { id: 'n2', type: 'idea', data: { label: 'Sibling' }, position: { x: 200, y: 0 } },
    ];
    const proposal: AIProposal = {
      id: 'rewrite-1',
      type: 'graph_patch',
      rationale: 'rewrite node',
      confidence: 0.8,
      patch: { updateNodes: [{ id: 'n1', data: { label: 'Rewritten label' } }] },
      status: 'accepted',
    };

    const result = applyAIProposalRuntime({
      proposals: [proposal],
      nodes,
      edges: [],
      extensions: {},
      activeTool: 'mindmap',
    });

    // Same node count → this is a MODIFY, not an ADD.
    expect(result.nodes.length).toBe(3);
    const n1 = result.nodes.find((n) => n.id === 'n1');
    expect(n1?.data.label).toBe('Rewritten label');
    // Siblings untouched.
    expect(result.nodes.find((n) => n.id === 'root')?.data.label).toBe('Central topic');
    expect(result.nodes.find((n) => n.id === 'n2')?.data.label).toBe('Sibling');
  });
});
