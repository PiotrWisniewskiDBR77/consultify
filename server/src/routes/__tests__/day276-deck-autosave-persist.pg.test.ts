/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';

const databaseUrl = process.env.DATABASE_URL ?? '';

describe(
  'Day 276 deck autosave persistence through ApiGateway and real PostgreSQL',
  { retry: 0 },
  () => {
    const suffix = randomUUID().slice(0, 8);
    const organizationId = `day276_deck_org_${suffix}`;
    const userId = `day276_deck_owner_${suffix}`;
    const deckId = `day276_deck_${suffix}`;
    const pool = new Pool({ connectionString: databaseUrl });
    const app = express();
    let token = '';

    beforeAll(async () => {
      expect(process.env.DB_TYPE).toBe('postgres');
      await assertRealPostgresTestEnvironment();
      app.use(express.json());
      ApiGateway.getInstance().initializeRoutes(app);
      await pool.query('INSERT INTO organizations (id, name) VALUES ($1, $2)', [
        organizationId,
        'Day 276 deck',
      ]);
      await pool.query(
        `INSERT INTO users (id, organization_id, email, role, status, is_active)
       VALUES ($1, $2, $3, 'OWNER', 'active', 1)`,
        [userId, organizationId, `${userId}@example.test`]
      );
      await pool.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
        [`member_${userId}`, organizationId, userId]
      );
      await pool.query(
        `INSERT INTO presentation_decks (id, organization_id, title, deck_json, version, status)
       VALUES ($1, $2, 'Day 276 deck', $3, 1, 'draft')`,
        [deckId, organizationId, JSON.stringify({ cards: [{ id: 'c1', title: 'Before' }] })]
      );
      token = jwt.sign(
        { id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' },
        config.JWT_SECRET
      );
    });

    afterAll(async () => {
      await pool.query('DELETE FROM presentation_deck_versions WHERE deck_id = $1', [deckId]);
      await pool.query('DELETE FROM presentation_decks WHERE id = $1', [deckId]);
      await pool.query('DELETE FROM organization_members WHERE organization_id = $1', [
        organizationId,
      ]);
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      await pool.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
      await pool.end();
    });

    it('autosave changes deck_json, advances version and snapshots the prior version', async () => {
      const nextDeck = { title: 'Day 276 saved', cards: [{ id: 'c1', title: 'After' }] };
      const saved = await request(app)
        .put(`/api/presentations/decks/${deckId}/autosave`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Deck-Version', '1')
        .send(nextDeck);
      expect(saved.status).toBe(200);

      const row = await pool.query(
        'SELECT deck_json, version FROM presentation_decks WHERE id = $1',
        [deckId]
      );
      expect(JSON.parse(row.rows[0].deck_json)).toEqual(nextDeck);
      expect(row.rows[0].version).toBe(2);
      const snapshots = await pool.query(
        'SELECT version, deck_json_snapshot FROM presentation_deck_versions WHERE deck_id = $1',
        [deckId]
      );
      expect(snapshots.rowCount).toBe(1);
      expect(snapshots.rows[0].version).toBe(1);
      expect(JSON.parse(snapshots.rows[0].deck_json_snapshot).cards[0].title).toBe('Before');
    });

    it('returns 409 for a stale X-Deck-Version and preserves the saved deck', async () => {
      const before = await pool.query(
        'SELECT deck_json, version FROM presentation_decks WHERE id = $1',
        [deckId]
      );
      const stale = await request(app)
        .put(`/api/presentations/decks/${deckId}/autosave`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Deck-Version', '1')
        .send({ title: 'STALE', cards: [] });
      expect(stale.status).toBe(409);
      expect(stale.body.code).toBe('VERSION_CONFLICT');
      const after = await pool.query(
        'SELECT deck_json, version FROM presentation_decks WHERE id = $1',
        [deckId]
      );
      expect(after.rows[0]).toEqual(before.rows[0]);
    });
  }
);
