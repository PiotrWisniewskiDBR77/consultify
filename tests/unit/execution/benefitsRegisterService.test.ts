import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;

const db = vi.hoisted(() => ({
  benefits: new Map<string, Row>(),
  uuidCounter: 0,
}));

function nextUuid() {
  db.uuidCounter += 1;
  return `benefit-id-${db.uuidCounter}`;
}

vi.mock('uuid', () => ({ v4: () => nextUuid() }));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (
      normalized.startsWith('CREATE TABLE') ||
      normalized.startsWith('CREATE INDEX') ||
      normalized.startsWith('CREATE UNIQUE INDEX')
    ) {
      return { changes: 0 };
    }
    if (normalized.startsWith('INSERT INTO initiative_benefits')) {
      const [
        id,
        organizationId,
        initiativeId,
        name,
        ownerId,
        baselineValue,
        targetValue,
        currentValue,
        cadence,
        status,
        source,
        _createdBy,
        createdAt,
        updatedAt,
      ] = params;
      db.benefits.set(id, {
        id,
        organization_id: organizationId,
        initiative_id: initiativeId,
        name,
        owner_id: ownerId,
        kpi_name: null,
        baseline_value: baselineValue,
        target_value: targetValue,
        current_value: currentValue,
        cadence,
        status,
        source,
        created_at: createdAt,
        updated_at: updatedAt,
      });
      return { changes: 1 };
    }
    throw new Error(`Unhandled dbRun SQL: ${normalized}`);
  },
  get: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.includes('FROM initiative_benefits')) {
      // handoff dedupe lookup: org + initiative + source_tag + persisted name
      const [organizationId, initiativeId, source, name] = params;
      const match = Array.from(db.benefits.values()).find(
        (row) =>
          row.organization_id === organizationId &&
          row.initiative_id === initiativeId &&
          row.source === source &&
          row.name === name
      );
      return match || null;
    }
    throw new Error(`Unhandled dbGet SQL: ${normalized}`);
  },
  all: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.includes('FROM initiative_benefits')) {
      const organizationId = params[0];
      const initiativeId = params.length > 1 ? params[1] : undefined;
      return Array.from(db.benefits.values()).filter(
        (row) =>
          row.organization_id === organizationId &&
          (initiativeId === undefined || row.initiative_id === initiativeId)
      );
    }
    throw new Error(`Unhandled dbAll SQL: ${normalized}`);
  },
}));

const ORG_A = 'org-aaaa';
const ORG_B = 'org-bbbb';

describe('benefitsRegisterService (M14/F6 6.1)', () => {
  beforeEach(() => {
    db.benefits.clear();
    db.uuidCounter = 0;
    vi.resetModules();
  });

  it('createBenefit persists an org-scoped row with defaults', async () => {
    const { createBenefit, listBenefits } =
      await import('../../../server/src/services/benefitsRegisterService.js');

    const created = await createBenefit(ORG_A, {
      name: 'Cycle time reduction',
      initiativeId: 'init-1',
      kpiName: 'Cycle time',
      baselineValue: 100,
      targetValue: 70,
    });

    expect(created.id).toBeTruthy();
    expect(created.organization_id).toBe(ORG_A);
    expect(created.name).toBe('Cycle time reduction');
    // defaults applied
    expect(created.status).toBe('tracking');
    expect(created.source).toBe('MANUAL');
    expect(created.baseline_value).toBe(100);
    expect(created.target_value).toBe(70);

    const listed = await listBenefits(ORG_A);
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(created.id);
  });

  it('createBenefit is org-scoped: list does not leak across orgs', async () => {
    const { createBenefit, listBenefits } =
      await import('../../../server/src/services/benefitsRegisterService.js');

    await createBenefit(ORG_A, { name: 'A benefit', initiativeId: 'init-a' });
    await createBenefit(ORG_B, { name: 'B benefit', initiativeId: 'init-b' });

    const orgA = await listBenefits(ORG_A);
    const orgB = await listBenefits(ORG_B);

    expect(orgA).toHaveLength(1);
    expect(orgA[0].name).toBe('A benefit');
    expect(orgB).toHaveLength(1);
    expect(orgB[0].name).toBe('B benefit');

    // list can be scoped to a single initiative
    const scoped = await listBenefits(ORG_A, 'init-a');
    expect(scoped).toHaveLength(1);
    const scopedMiss = await listBenefits(ORG_A, 'init-x');
    expect(scopedMiss).toHaveLength(0);
  });

  it('createBenefit requires org and name', async () => {
    const { createBenefit } =
      await import('../../../server/src/services/benefitsRegisterService.js');

    await expect(createBenefit('', { name: 'x' })).rejects.toThrow(/organizationId/);
    await expect(createBenefit(ORG_A, { name: '   ' })).rejects.toThrow(/name/);
  });

  it('handoffFromClosure creates a tracked benefit from KPI delta with handoff source', async () => {
    const { handoffFromClosure, listBenefits, BENEFIT_HANDOFF_SOURCE } =
      await import('../../../server/src/services/benefitsRegisterService.js');

    const benefit = await handoffFromClosure(ORG_A, 'init-42', {
      kpiName: 'On-time delivery',
      ownerId: 'user-7',
      baselineValue: 60,
      targetValue: 90,
      currentValue: 88,
      cadence: 'monthly',
    });

    expect(benefit.organization_id).toBe(ORG_A);
    expect(benefit.initiative_id).toBe('init-42');
    expect(benefit.kpi_name).toBe('On-time delivery');
    expect(benefit.owner_id).toBe('user-7');
    expect(benefit.baseline_value).toBe(60);
    expect(benefit.target_value).toBe(90);
    expect(benefit.current_value).toBe(88);
    expect(benefit.cadence).toBe('monthly');
    expect(benefit.status).toBe('tracking');
    expect(benefit.source).toBe(BENEFIT_HANDOFF_SOURCE);
    expect(BENEFIT_HANDOFF_SOURCE).toBe('M14_CLOSURE_HANDOFF');
    // derived name when none supplied
    expect(benefit.name).toContain('On-time delivery');

    const listed = await listBenefits(ORG_A, 'init-42');
    expect(listed).toHaveLength(1);
    expect(listed[0].source).toBe(BENEFIT_HANDOFF_SOURCE);
  });

  it('handoffFromClosure dedupes a repeated handoff for the same KPI', async () => {
    const { handoffFromClosure, listBenefits } =
      await import('../../../server/src/services/benefitsRegisterService.js');

    const first = await handoffFromClosure(ORG_A, 'init-9', {
      kpiName: 'Defect rate',
      baselineValue: 5,
      targetValue: 1,
    });
    const second = await handoffFromClosure(ORG_A, 'init-9', {
      kpiName: 'Defect rate',
      baselineValue: 5,
      targetValue: 1,
    });

    expect(second.id).toBe(first.id);
    const listed = await listBenefits(ORG_A, 'init-9');
    expect(listed).toHaveLength(1);
  });

  it('handoffFromClosure requires org and initiative', async () => {
    const { handoffFromClosure } =
      await import('../../../server/src/services/benefitsRegisterService.js');

    await expect(handoffFromClosure('', 'init-1', {})).rejects.toThrow(/organizationId/);
    await expect(handoffFromClosure(ORG_A, '', {})).rejects.toThrow(/initiativeId/);
  });
});
