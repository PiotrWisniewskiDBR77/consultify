/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from './_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';

/**
 * FIX-232 / A2 (ODBIÓR 232, blokujący scalenie).
 *
 * `presentationAgentEditService.ts:508` (`add_source`) used to build a
 * citation directly from whatever `https?://…` string it could regex out of
 * the prompt — a URL pasted into chat, with zero verification, became a
 * "source" on the slide. That is the same class of defect FIX-231 closed a
 * week earlier one file over (provenance stamp echoing a flag instead of a
 * fact): a presentation that LOOKS documented but isn't is worse than one
 * with no sources at all, because it lies to the client's board.
 *
 * The gate (BRAMKA) requires BOTH halves of the pair, proved against a real
 * Postgres through the real ApiGateway/JWT stack — a lone "rejected" test
 * proves nothing if the feature is simply broken for everyone:
 *   1. an address pasted from chat with no matching knowledge base document
 *      is rejected with a clear, actionable error (AI_SOURCE_NOT_VERIFIED);
 *   2. a real `knowledge_documents` row for the SAME organization passes
 *      verification and its DB-sourced id/title land in the citation
 *      (never the raw prompt text).
 */
describe(
  'AUDYT232 add_source: raw chat URL rejected, real knowledge-base source passes',
  NO_RETRY,
  () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const app = express();
    const organizationId = randomUUID();
    const userId = randomUUID();
    const deckId = randomUUID();
    const knowledgeDocId = randomUUID();
    const realSourceUrl = `https://kb.example.test/${randomUUID()}/report`;
    const realSourceTitle = 'Realny raport z bazy wiedzy A232';
    const unverifiedUrl = `https://untrusted-chat-paste.example.test/${randomUUID()}`;
    let authorization = '';

    beforeAll(async () => {
      // The five editorial operations (incl. add_source) are only recognised
      // when this flag is on (ODBIÓR 232: "gate is outside the flag; the
      // flag controls only recognition of the five new operations").
      expect(process.env.ENABLE_TERESA_DECK_EDIT).toBe('true');
      expect(process.env.DB_TYPE).toBe('postgres');
      await assertRealPostgresTestEnvironment();
      const [{ ApiGateway }, { default: config }, { errorHandlerMiddleware }] = await Promise.all([
        import('../../server/src/Gateway.js'),
        import('../../server/src/config/Config.js'),
        import('../../server/src/utils/ErrorHandler.js'),
      ]);
      app.use(express.json({ limit: '10mb' }));
      ApiGateway.getInstance().initializeRoutes(app);
      // The production app mounts this centrally (server/src/index.ts); the
      // minimal test harness must do the same, otherwise a thrown AppError
      // (e.g. AI_SOURCE_NOT_VERIFIED) falls through to Express's default
      // HTML error page instead of the real JSON error contract.
      app.use(errorHandlerMiddleware);

      await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,'A232-src','active')`, [
        organizationId,
      ]);
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status,email_verified)
         VALUES($1,$2,$3,'unused','OWNER','active',1)`,
        [userId, organizationId, `a232-src-${userId}@test.invalid`]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status)
         VALUES($1,$2,$3,'OWNER','ACTIVE')`,
        [randomUUID(), organizationId, userId]
      );

      const deckJson = {
        deck_id: deckId,
        title: 'A232 add_source deck',
        cards: [
          {
            card_id: randomUUID(),
            deck_id: deckId,
            order_index: 0,
            intent: 'summary',
            layout_id: 'content_full',
            title: 'Slide 1',
            blocks: [{ type: 'text', content: { text: 'Body text for slide 1.' } }],
            source_refs: [],
          },
        ],
      };
      await pool.query(
        `INSERT INTO presentation_decks(id,organization_id,title,template_id,status,version,deck_json)
         VALUES($1,$2,$3,'default','draft',1,$4)`,
        [deckId, organizationId, deckJson.title, JSON.stringify(deckJson)]
      );

      // The one REAL, org-owned knowledge base document. Only this URL may
      // ever become a citation.
      await pool.query(
        `INSERT INTO knowledge_documents(id, organization_id, title, document_type, source_type, source_url)
         VALUES($1,$2,$3,'url','url',$4)`,
        [knowledgeDocId, organizationId, realSourceTitle, realSourceUrl]
      );

      authorization = `Bearer ${jwt.sign(
        {
          id: userId,
          userId,
          organizationId,
          organization_id: organizationId,
          role: 'OWNER',
          email: `a232-src-${userId}@test.invalid`,
        },
        config.JWT_SECRET,
        { expiresIn: '30m', jwtid: randomUUID() }
      )}`;
    }, 60_000);

    afterAll(async () => {
      await pool.query(`DELETE FROM knowledge_documents WHERE id=$1`, [knowledgeDocId]);
      await pool.query(`DELETE FROM presentation_decks WHERE id=$1`, [deckId]);
      await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]);
      await pool.query(`DELETE FROM users WHERE id=$1`, [userId]);
      await pool.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
      await pool.end();
      const pgModule = await import('../../server/src/database/PostgresDatabase.js');
      await (pgModule as any).closePool?.();
    });

    it('member 1: rejects a raw chat URL with no matching knowledge base document', async () => {
      const res = await request(app)
        .post(`/api/presentations/decks/${deckId}/agent-edit`)
        .set('Authorization', authorization)
        .send({ prompt: `dodaj źródło ${unverifiedUrl} slajd 1` });

      // eslint-disable-next-line no-console
      console.log(`\n>>> AUDYT232 add_source(unverified) status=${res.status} body=${JSON.stringify(res.body)}\n`);

      expect(res.status, JSON.stringify(res.body)).not.toBe(200);
      expect(JSON.stringify(res.body)).toContain('AI_SOURCE_NOT_VERIFIED');
      // The rejected URL itself must never silently appear as a citation.
      expect(JSON.stringify(res.body)).not.toContain('"source_type":"url"');

      const row = (await pool.query(`SELECT deck_json FROM presentation_decks WHERE id=$1`, [deckId])).rows[0];
      expect(JSON.parse(row.deck_json).cards[0].source_refs).toEqual([]);
    });

    it('member 2: a real knowledge-base source passes and lands in the citation with DB-sourced id/title', async () => {
      const res = await request(app)
        .post(`/api/presentations/decks/${deckId}/agent-edit`)
        .set('Authorization', authorization)
        .send({ prompt: `dodaj źródło ${realSourceUrl} slajd 1` });

      // eslint-disable-next-line no-console
      console.log(`\n>>> AUDYT232 add_source(verified) status=${res.status} body=${JSON.stringify(res.body)}\n`);

      expect(res.status, JSON.stringify(res.body)).toBe(200);
      const proposedDeck = res.body.data.deck;
      const sourceRefs = proposedDeck.cards[0].source_refs;
      expect(sourceRefs).toEqual([
        {
          source_id: knowledgeDocId,
          source_type: 'knowledge_document',
          title: realSourceTitle,
          url: realSourceUrl,
        },
      ]);

      // Proposal only — the persisted deck is untouched until /accept.
      const row = (await pool.query(`SELECT deck_json FROM presentation_decks WHERE id=$1`, [deckId])).rows[0];
      expect(JSON.parse(row.deck_json).cards[0].source_refs).toEqual([]);
    });
  }
);
