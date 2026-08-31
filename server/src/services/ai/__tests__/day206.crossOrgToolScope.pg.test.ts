/**
 * FIX-206 (P0) — kontrakt bezpieczeństwa pętli narzędziowej Teresy.
 *
 * Odbiór dyżuru 206 zmierzył wyciek: `executeGetInitiativeStatus` filtrował
 * wyłącznie po `project_id`, a wiring pętli karmił go `projectId` wprost
 * z ciała żądania — użytkownik organizacji A dostawał nazwę, status i ROI
 * inicjatywy organizacji B. Ten test pilnuje, żeby to nie wróciło.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.DB_TYPE = 'postgres';

const enabled = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB !== 'true';

describe.skipIf(!enabled)('FIX-206 P0 — izolacja organizacji w narzędziach pętli', () => {
  const orgA = `org-a-${randomUUID()}`;
  const orgB = `org-b-${randomUUID()}`;
  const projectB = `proj-b-${randomUUID()}`;
  const initiativeB = `init-b-${randomUUID()}`;
  let run: any;

  beforeAll(async () => {
    const { run: dbRun } = await import('../../../utils/DbPromise.js');
    run = dbRun;
    for (const [id, name] of [
      [orgA, 'Org A'],
      [orgB, 'Org B'],
    ] as const) {
      await run(`INSERT INTO organizations (id, name) VALUES (?, ?) ON CONFLICT (id) DO NOTHING`, [
        id,
        name,
      ]);
    }
    await run(
      `INSERT INTO projects (id, name, organization_id) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING`,
      [projectB, 'Projekt organizacji B', orgB]
    );
    await run(
      `INSERT INTO initiatives (id, name, status, project_id, organization_id)
       VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
      [initiativeB, 'ZNACZNIK-FIX206-TAJNA-INICJATYWA-ORG-B', 'EXECUTING', projectB, orgB]
    );
  });

  afterAll(async () => {
    if (!run) return;
    await run(`DELETE FROM initiatives WHERE id = ?`, [initiativeB]);
    await run(`DELETE FROM projects WHERE id = ?`, [projectB]);
    await run(`DELETE FROM organizations WHERE id IN (?, ?)`, [orgA, orgB]);
  });

  it('nie zwraca inicjatywy cudzej organizacji, nawet gdy podano jej projectId', async () => {
    const { executeToolCall } = await import('../toolDefinitions.js');
    const raw = await executeToolCall(
      'get_initiative_status',
      {},
      { organizationId: orgA, userId: 'user-a', projectId: projectB }
    );
    expect(raw).not.toContain('ZNACZNIK-FIX206-TAJNA-INICJATYWA-ORG-B');
    const parsed = JSON.parse(raw);
    expect(parsed.total ?? 0).toBe(0);
  });

  it('właściciel organizacji nadal widzi własną inicjatywę (czułość testu)', async () => {
    const { executeToolCall } = await import('../toolDefinitions.js');
    const raw = await executeToolCall(
      'get_initiative_status',
      {},
      { organizationId: orgB, userId: 'user-b', projectId: projectB }
    );
    expect(raw).toContain('ZNACZNIK-FIX206-TAJNA-INICJATYWA-ORG-B');
  });
});
