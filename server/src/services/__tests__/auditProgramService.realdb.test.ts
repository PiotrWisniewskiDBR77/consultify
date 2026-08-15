import { randomUUID } from 'crypto';
import { afterAll, describe, expect, it } from 'vitest';

import { run } from '../../utils/DbPromise.js';
import {
  createProgram,
  deleteProgram,
  getProgram,
  listPrograms,
  updateProgram,
} from '../auditProgramService.js';

const describeRealDb = process.env.DATABASE_URL ? describe : describe.skip;
const orgA = `audit-beta-a-${randomUUID()}`;
const orgB = `audit-beta-b-${randomUUID()}`;
const createdIds: string[] = [];

describeRealDb('AUD-001 base CRUD on real PostgreSQL', () => {
  afterAll(async () => {
    await run(`DELETE FROM audit_programs WHERE organization_id IN (?, ?)`, [orgA, orgB], {
      fallback: false,
    });
  });

  it('create -> cold read -> save -> complete -> reopen -> delete stays tenant-scoped', async () => {
    const created = await createProgram(orgA, 'consultant-a', {
      name: 'Supplier readiness audit',
      objective: 'Verify operational readiness',
      status: 'draft',
      config: { templateIds: [], assigneeIds: [] },
    });
    createdIds.push(created.id);

    const coldRead = await getProgram(orgA, created.id);
    expect(coldRead).toMatchObject({
      id: created.id,
      organizationId: orgA,
      name: 'Supplier readiness audit',
      status: 'draft',
    });
    expect(await getProgram(orgB, created.id)).toBeNull();

    const saved = await updateProgram(orgA, created.id, {
      name: 'Supplier readiness audit v2',
      description: 'Saved from the base beta editor',
      status: 'completed',
    });
    expect(saved).toMatchObject({ name: 'Supplier readiness audit v2', status: 'completed' });
    expect(await updateProgram(orgB, created.id, { name: 'Cross-tenant write' })).toBeNull();

    const reopened = await updateProgram(orgA, created.id, { status: 'draft' });
    expect(reopened?.status).toBe('draft');
    const registry = await listPrograms(orgA, { search: 'readiness', status: 'draft' });
    expect(registry.programs.map((program) => program.id)).toContain(created.id);

    expect(await deleteProgram(orgB, created.id)).toBe(false);
    expect(await deleteProgram(orgA, created.id)).toBe(true);
    expect(await getProgram(orgA, created.id)).toBeNull();
    createdIds.length = 0;
  });
});
