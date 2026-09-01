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
 * FIX-232 / A1 (ODBIÓR 232, blokujący scalenie).
 *
 * Powód istnienia: `day232.presentation-agent-edit-state.contract.test.ts`
 * dostarczony w pakiecie 232 to test OBECNOŚCI TEKSTU (`readFileSync` +
 * `toContain`), nie test ZACHOWANIA. Mutacja M4 — usunięcie WYŁĄCZNIE
 * `if (!claimed) { return 409 }` w `/accept` (presentations.routes.ts:4203-4209),
 * zachowując `resolveAiOperation(..., 'draft')` i `AND status = ?` jako
 * literały tekstowe — daje 12/12 zielono na pakiecie 232, mimo że warstwa 3
 * (atomowe zajęcie operacji) jest realnie wyłączona.
 *
 * Ten test uderza w warstwę 3 przez SKUTEK (dwa równoczesne accept na tej
 * samej operacji), nie przez treść pliku źródłowego — mutacja M4 nie ma się
 * gdzie ukryć.
 */
describe('AUDYT232 wyścig dwóch równoczesnych zatwierdzeń tej samej propozycji', NO_RETRY, () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = express();
  const organizationId = randomUUID();
  const userId = randomUUID();
  const deckId = randomUUID();
  let authorization = '';

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    const [{ ApiGateway }, { default: config }] = await Promise.all([
      import('../../server/src/Gateway.js'),
      import('../../server/src/config/Config.js'),
    ]);
    app.use(express.json({ limit: '10mb' }));
    ApiGateway.getInstance().initializeRoutes(app);

    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,'A232-race','active')`, [
      organizationId,
    ]);
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status,email_verified)
       VALUES($1,$2,$3,'unused','OWNER','active',1)`,
      [userId, organizationId, `day232-race-${userId}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    const originalDeck = {
      deck_id: deckId,
      title: 'A232 race deck',
      cards: [
        {
          card_id: randomUUID(),
          deck_id: deckId,
          order_index: 0,
          intent: 'summary',
          layout_id: 'content_full',
          title: 'Original title',
          blocks: [{ type: 'text', content: { text: 'A very long original sentence for shortening.' } }],
          source_refs: [],
        },
      ],
    };
    await pool.query(
      `INSERT INTO presentation_decks(id,organization_id,title,template_id,status,version,deck_json)
       VALUES($1,$2,$3,'default','draft',1,$4)`,
      [deckId, organizationId, originalDeck.title, JSON.stringify(originalDeck)]
    );
    authorization = `Bearer ${jwt.sign(
      {
        id: userId,
        userId,
        organizationId,
        organization_id: organizationId,
        role: 'OWNER',
        email: `day232-race-${userId}@test.invalid`,
      },
      config.JWT_SECRET,
      { expiresIn: '30m', jwtid: randomUUID() }
    )}`;
  }, 60_000);

  afterAll(async () => {
    await pool.query(`DELETE FROM presentation_decks WHERE id=$1`, [deckId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM users WHERE id=$1`, [userId]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await pool.end();
    const pgModule = await import('../../server/src/database/PostgresDatabase.js');
    await (pgModule as any).closePool?.();
  });

  it('para rozstrzygająca: jedno równoczesne zatwierdzenie przechodzi (200), bliźniak dostaje 409, deck zmienia się dokładnie raz', async () => {
    const proposal = await request(app)
      .post(`/api/presentations/decks/${deckId}/agent-edit`)
      .set('Authorization', authorization)
      .send({ prompt: 'skróć slajd 1' });
    expect(proposal.status, JSON.stringify(proposal.body)).toBe(200);
    const operationId = String(proposal.body.data.operationId);
    expect(
      (await pool.query(`SELECT status FROM presentation_ai_operations WHERE id=$1`, [operationId]))
        .rows[0].status
    ).toBe('draft');

    const before = (await pool.query(`SELECT version, deck_json FROM presentation_decks WHERE id=$1`, [deckId]))
      .rows[0];

    const hit = () =>
      request(app)
        .post(`/api/presentations/decks/${deckId}/agent-edit/${operationId}/accept`)
        .set('Authorization', authorization)
        .send({});

    // Rzeczywista równoczesność: obie promesy startują przed pierwszym `await`.
    const [a, b] = await Promise.all([hit(), hit()]);
    const codes = [a.status, b.status].sort((x, y) => x - y);

    const after = (await pool.query(`SELECT version, deck_json FROM presentation_decks WHERE id=$1`, [deckId]))
      .rows[0];
    const finalOpStatus = (
      await pool.query(`SELECT status, version_after FROM presentation_ai_operations WHERE id=$1`, [operationId])
    ).rows[0];

    // eslint-disable-next-line no-console
    console.log(
      `\n>>> AUDYT232 statusy=${JSON.stringify(codes)} wersja ${before.version} -> ${after.version} operacja=${JSON.stringify(finalOpStatus)}\n`
    );

    // człon 1: właściwe zatwierdzenie przechodzi
    expect(codes).toContain(200);
    // człon 2: równoczesny bliźniak jest odrzucony, nie zdublowany
    expect(codes).toContain(409);
    expect(codes).toEqual([200, 409]);

    // skutek na danych: operacja zastosowana DOKŁADNIE raz, nie zgubiona ani nie podwojona
    expect(after.version).toBe(before.version + 1);
    expect(after.deck_json).not.toBe(before.deck_json);
    expect(finalOpStatus.status).toBe('applied');
    expect(finalOpStatus.version_after).toBe(after.version);
  });
});
