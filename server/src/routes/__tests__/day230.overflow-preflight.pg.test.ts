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

// FIX-230 F1: a realistic persisted CardBlock — this is the exact shape
// `deckData.ts` pushBlock writes and `PUT /decks/:deckId/autosave` stores.
// `block_id`/`card_id` alone are ~45-90 chars of structural noise per
// block; ODBIOR_230 measured the pre-fix detector summing them as if they
// were slide copy. Tests that only ever exercise `blocks: []` (like the
// original two below) cannot catch that regression — they never build a
// block that HAS an id.
function pushBlockShaped(
  deckId: string,
  cardIdx: number,
  blockIdx: number,
  type: string,
  content: Record<string, unknown>
) {
  return {
    block_id: `block-${deckId}-${cardIdx}-${blockIdx}`,
    card_id: `card-${deckId}-${cardIdx}`,
    type,
    content,
    is_refreshable: false,
    position: { area: 'full', order: blockIdx },
    ai_editable: true,
  };
}

// A slide shaped like the report's own "deck bez zarzutu" reproduction:
// title + three short bullets, comfortably under the 240-char `balanced`
// budget once metadata is excluded — but ~260+ once it isn't.
function goodSlide(deckId: string, cardIdx: number, title: string, bullets: string[]) {
  return {
    title,
    key_message: '',
    blocks: [
      pushBlockShaped(deckId, cardIdx, 0, 'heading', { text: title, level: 2 }),
      pushBlockShaped(deckId, cardIdx, 1, 'bullet_list', { items: bullets }),
    ],
  };
}

describe('Day230 overflow preflight through real ApiGateway', { retry: 0 }, () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const memberId = randomUUID();
  const deckId = randomUUID();
  const deckIdFalseAlarmGate = randomUUID();
  const deckIdTruePositiveGate = randomUUID();
  let app: express.Express;
  let pool: Pool;
  let token = '';

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.MOCK_DB).toBe('false');
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      `INSERT INTO organizations(id,name,plan,status) VALUES($1,'Day230','enterprise','active')`,
      [organizationId]
    );
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status)
       VALUES($1,$2,$3,'unused','OWNER','active')`,
      [userId, organizationId, `day230-${userId}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [memberId, organizationId, userId]
    );
    await pool.query(
      `INSERT INTO presentation_decks(id,organization_id,title,template_id,deck_json,version,status,created_by)
       VALUES($1,$2,'Day230 overflow','default',$3,1,'draft',$4)`,
      [
        deckId,
        organizationId,
        JSON.stringify({
          cards: [
            { title: 'Okładka', key_message: 'Krótko', blocks: [] },
            { title: 'Kontekst', key_message: 'Krótko', blocks: [] },
            { title: 'Wniosek', key_message: 'x'.repeat(721), blocks: [] },
          ],
        }),
        userId,
      ]
    );

    // FIX-230 F9 — false-alarm gate, deck #1: five slides shaped exactly
    // like ODBIOR_230's own reproduction (title + 3 bullets, 41-61 visible
    // chars each, real `block_id`/`card_id` metadata on every block) plus
    // a sixth slide that is deliberately, hugely overflowing but
    // `enabled: false` (F3). A correct detector must be SILENT on all six.
    await pool.query(
      `INSERT INTO presentation_decks(id,organization_id,title,template_id,deck_json,version,status,created_by)
       VALUES($1,$2,'Day230 false-alarm gate','default',$3,1,'draft',$4)`,
      [
        deckIdFalseAlarmGate,
        organizationId,
        JSON.stringify({
          cards: [
            goodSlide(deckIdFalseAlarmGate, 0, 'Agenda', [
              'Kontekst projektu',
              'Zakres prac',
              'Następne kroki',
            ]),
            goodSlide(deckIdFalseAlarmGate, 1, 'Cele programu', [
              'Skrócić czas wdrożenia',
              'Podnieść jakość danych',
              'Zbudować zespół',
            ]),
            goodSlide(deckIdFalseAlarmGate, 2, 'Zakres', [
              'Moduł raportowania',
              'Integracja z ERP',
              'Panel administracyjny',
            ]),
            goodSlide(deckIdFalseAlarmGate, 3, 'Harmonogram', [
              'Faza 1 — odkrycie',
              'Faza 2 — budowa',
              'Faza 3 — wdrożenie',
            ]),
            goodSlide(deckIdFalseAlarmGate, 4, 'Ryzyka', [
              'Brak dostępu do danych',
              'Opóźnienia dostawcy',
              'Zmiana zakresu',
            ]),
            {
              title: 'Wyłączony ze slajdów',
              key_message: '',
              enabled: false,
              blocks: [
                pushBlockShaped(deckIdFalseAlarmGate, 5, 0, 'paragraph', {
                  text: 'x'.repeat(2000),
                }),
              ],
            },
          ],
        }),
        userId,
      ]
    );

    // FIX-230 F9 — false-alarm gate, deck #2: the same five clean slides
    // plus a sixth that IS enabled and genuinely overflows through
    // `blocks[].content` (not the `key_message` shortcut the pre-fix
    // sample used) — proving a real positive still fires once metadata is
    // excluded from the count.
    await pool.query(
      `INSERT INTO presentation_decks(id,organization_id,title,template_id,deck_json,version,status,created_by)
       VALUES($1,$2,'Day230 true-positive gate','default',$3,1,'draft',$4)`,
      [
        deckIdTruePositiveGate,
        organizationId,
        JSON.stringify({
          cards: [
            goodSlide(deckIdTruePositiveGate, 0, 'Agenda', [
              'Kontekst projektu',
              'Zakres prac',
              'Następne kroki',
            ]),
            goodSlide(deckIdTruePositiveGate, 1, 'Cele programu', [
              'Skrócić czas wdrożenia',
              'Podnieść jakość danych',
              'Zbudować zespół',
            ]),
            goodSlide(deckIdTruePositiveGate, 2, 'Zakres', [
              'Moduł raportowania',
              'Integracja z ERP',
              'Panel administracyjny',
            ]),
            goodSlide(deckIdTruePositiveGate, 3, 'Harmonogram', [
              'Faza 1 — odkrycie',
              'Faza 2 — budowa',
              'Faza 3 — wdrożenie',
            ]),
            goodSlide(deckIdTruePositiveGate, 4, 'Ryzyka', [
              'Brak dostępu do danych',
              'Opóźnienia dostawcy',
              'Zmiana zakresu',
            ]),
            {
              title: 'Przeciążony slajd',
              key_message: '',
              blocks: [
                pushBlockShaped(deckIdTruePositiveGate, 5, 0, 'paragraph', {
                  text: 'x'.repeat(400),
                }),
                pushBlockShaped(deckIdTruePositiveGate, 5, 1, 'paragraph', {
                  text: 'y'.repeat(400),
                }),
              ],
            },
          ],
        }),
        userId,
      ]
    );

    token = jwt.sign(
      { id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '30m' }
    );
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 30_000);

  afterAll(async () => {
    delete process.env.ENABLE_DECK_OVERFLOW_WARNING;
    if (!pool) return;
    for (const id of [deckId, deckIdFalseAlarmGate, deckIdTruePositiveGate]) {
      const links = await pool.query<{ artifact_id: string }>(
        `SELECT artifact_id FROM v8_artifact_origin_links
         WHERE organization_id=$1 AND origin_runtime='presentation' AND origin_record_id=$2`,
        [organizationId, id]
      );
      await pool.query(
        `DELETE FROM v8_artifact_origin_links
         WHERE organization_id=$1 AND origin_runtime='presentation' AND origin_record_id=$2`,
        [organizationId, id]
      );
      for (const row of links.rows) {
        await pool.query('DELETE FROM v8_output_artifacts WHERE artifact_id=$1', [row.artifact_id]);
      }
      await pool.query('DELETE FROM presentation_decks WHERE id=$1', [id]);
    }
    await pool.query('DELETE FROM organization_members WHERE id=$1', [memberId]);
    await pool.query('DELETE FROM users WHERE id=$1', [userId]);
    await pool.query('DELETE FROM organizations WHERE id=$1', [organizationId]);
    await pool.end();
  });

  it('ON zwraca nieblokujące ostrzeżenie z numerem slajdu 3', async () => {
    process.env.ENABLE_DECK_OVERFLOW_WARNING = 'true';
    const response = await request(app)
      .get(`/api/presentations/decks/${deckId}/download?mode=draft&preflight=overflow`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.overflowWarnings).toHaveLength(1);
    expect(response.body.data.overflowWarnings[0]).toMatchObject({ slideIndex: 3 });
  });

  it('OFF zachowuje ciszę', async () => {
    delete process.env.ENABLE_DECK_OVERFLOW_WARNING;
    const response = await request(app)
      .get(`/api/presentations/decks/${deckId}/download?mode=draft&preflight=overflow`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.overflowWarnings).toEqual([]);
  });

  // FIX-230 F9 — THE bramka this fix exists for. Real HTTP route, real
  // ApiGateway, real PostgreSQL row, flag ON: a deck with no problem must
  // stay silent, and a deck with a real problem must still speak up with
  // the right slide number. ODBIOR_230 measured 5/5 false alarms on
  // exactly this shape before F1-F3; this asserts the counter-proof.
  it('F9: pięć poprawnych slajdów (realne block_id/card_id) + wyłączony przepełniony ⇒ cisza', async () => {
    process.env.ENABLE_DECK_OVERFLOW_WARNING = 'true';
    const response = await request(app)
      .get(`/api/presentations/decks/${deckIdFalseAlarmGate}/download?mode=draft&preflight=overflow`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.overflowWarnings).toEqual([]);
  });

  it('F9: ten sam kształt + jeden WŁĄCZONY przeciążony slajd ⇒ ostrzeżenie z numerem slajdu', async () => {
    process.env.ENABLE_DECK_OVERFLOW_WARNING = 'true';
    const response = await request(app)
      .get(`/api/presentations/decks/${deckIdTruePositiveGate}/download?mode=draft&preflight=overflow`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.overflowWarnings).toHaveLength(1);
    expect(response.body.data.overflowWarnings[0]).toMatchObject({ slideIndex: 6, powod: 'tresc' });
  });
});
