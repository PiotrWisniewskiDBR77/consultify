/** @vitest-environment node */

/**
 * Missing-gate finding (zaległość #2, zgłoszona 2026-08-30, nienaprawiona wtedy
 * bo poza zakresem): `interviewEnterpriseService.getSegments` — jedyna z rodziny
 * `session_id`-scoped odczytów w tym pliku, która NIE woła `assertSessionInOrg`
 * przed odczytem (por. `createSegment`/`createQuota`/... tuż obok, które wołają).
 *
 * Dziś jest bezpieczna wyłącznie dzięki temu, że samo zapytanie SELECT filtruje
 * `WHERE organization_id = ? AND session_id = ?` — ale nic w kodzie nie
 * zaalarmuje, jeśli ten predykat kiedyś zniknie (np. refaktor "uproszczenia"
 * zapytania, albo zmiana na `SELECT * ... WHERE session_id = ?` bo "session_id
 * jest unikalne, po co dublować").
 *
 * Ten test dowodzi na REALNYM, zmigrowanym PostgreSQL (nie na atrapie
 * queryHelpers) obu połówek pary dowodowej:
 *   — obcy (org A, sesja org B) NIE dostaje nic,
 *   — właściciel (org A, sesja org A) DOSTAJE swoje segmenty.
 *
 * BRAMKA (potwierdzona ręcznie, opisana w raporcie dyżuru): usunięcie
 * `organization_id = ?` z zapytania w `getSegments` (interviewEnterpriseService.ts)
 * powoduje czerwony test "stranger sees nothing" — obcy zaczyna widzieć segment
 * session B. Przywrócenie predykatu → zielony.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import { interviewEnterpriseService } from '../interviewEnterpriseService.js';

describe('interviewEnterpriseService.getSegments — cross-org read gate (real PostgreSQL)', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const orgA = `getseg-a-${randomUUID()}`;
  const orgB = `getseg-b-${randomUUID()}`;
  const ownerA = `getseg-owner-a-${randomUUID()}`;
  const ownerB = `getseg-owner-b-${randomUUID()}`;
  const sessionA = `getseg-session-a-${randomUUID()}`;
  const sessionB = `getseg-session-b-${randomUUID()}`;
  const segmentA = `getseg-segment-a-${randomUUID()}`;
  const segmentB = `getseg-segment-b-${randomUUID()}`;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();

    for (const [org, label] of [
      [orgA, 'A'],
      [orgB, 'B'],
    ] as const) {
      await pool.query(`INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'active')`, [
        org,
        `getSegments cross-org ${label}`,
      ]);
    }
    await pool.query(
      `INSERT INTO users (id, organization_id, email, password, role, status)
       VALUES ($1, $2, $3, 'unused-local-only', 'OWNER', 'active')`,
      [ownerA, orgA, `${ownerA}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO users (id, organization_id, email, password, role, status)
       VALUES ($1, $2, $3, 'unused-local-only', 'OWNER', 'active')`,
      [ownerB, orgB, `${ownerB}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO interview_sessions (id, organization_id, name, owner_id, status)
       VALUES ($1, $2, 'getSegments cross-org session A', $3, 'in_progress')`,
      [sessionA, orgA, ownerA]
    );
    await pool.query(
      `INSERT INTO interview_sessions (id, organization_id, name, owner_id, status)
       VALUES ($1, $2, 'getSegments cross-org session B', $3, 'in_progress')`,
      [sessionB, orgB, ownerB]
    );
    await pool.query(
      `INSERT INTO interview_respondent_segments (id, organization_id, session_id, segment_name, criteria)
       VALUES ($1, $2, $3, 'Segment belonging to org A', '{}')`,
      [segmentA, orgA, sessionA]
    );
    await pool.query(
      `INSERT INTO interview_respondent_segments (id, organization_id, session_id, segment_name, criteria)
       VALUES ($1, $2, $3, 'Segment belonging to org B — must stay invisible to org A', '{}')`,
      [segmentB, orgB, sessionB]
    );
  }, 30_000);

  afterAll(async () => {
    await pool.query(`DELETE FROM interview_respondent_segments WHERE organization_id IN ($1,$2)`, [
      orgA,
      orgB,
    ]);
    await pool.query(`DELETE FROM interview_sessions WHERE organization_id IN ($1,$2)`, [
      orgA,
      orgB,
    ]);
    await pool.query(`DELETE FROM users WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgA, orgB]);
    await pool.end();
  });

  it('a stranger (org A, asking for org B\'s session) sees NOTHING', async () => {
    const segments = await interviewEnterpriseService.getSegments(orgA, sessionB);
    expect(segments).toEqual([]);
  });

  it('the owner (org A, asking for org A\'s own session) sees its segment', async () => {
    const segments = await interviewEnterpriseService.getSegments(orgA, sessionA);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      id: segmentA,
      sessionId: sessionA,
      segmentName: 'Segment belonging to org A',
    });
  });

  it('symmetric check: org B cannot see org A\'s session either', async () => {
    const segments = await interviewEnterpriseService.getSegments(orgB, sessionA);
    expect(segments).toEqual([]);
  });

  it('symmetric check: org B sees its own segment', async () => {
    const segments = await interviewEnterpriseService.getSegments(orgB, sessionB);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ id: segmentB, sessionId: sessionB });
  });
});
