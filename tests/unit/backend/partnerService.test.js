import { describe, expect, it, vi } from 'vitest';

vi.mock('uuid', () => ({
  v4: () => 'uuid-1',
}));

let PARTNER_TYPES;
let PartnerServiceClass;

async function load() {
  if (PARTNER_TYPES && PartnerServiceClass) return;
  const mod = await import('../../../server/src/services/partnerService.ts');
  PARTNER_TYPES = mod.PARTNER_TYPES;
  PartnerServiceClass = mod.PartnerServiceClass;
}

function createFakeDb({ getRow } = {}) {
  return {
    all: vi.fn((sql, params, cb) => cb(null, [])),
    get: vi.fn((sql, params, cb) => cb(null, getRow ? getRow(sql, params) : null)),
    run: vi.fn((sql, params, cb) => cb.call({ lastID: undefined, changes: 1 }, null)),
  };
}

describe('PartnerServiceClass (server/src/services/partnerService.ts)', () => {
  it('creates a partner and persists metadata JSON', async () => {
    await load();
    const db = createFakeDb();
    const svc = new PartnerServiceClass({ db });

    const created = await svc.createPartner({
      name: 'Acme Partner',
      partnerType: PARTNER_TYPES.REFERRAL,
      email: 'p@acme.com',
      metadata: { tier: 'GOLD' },
    });

    expect(created).toMatchObject({
      id: 'uuid-1',
      name: 'Acme Partner',
      partner_type: PARTNER_TYPES.REFERRAL,
      email: 'p@acme.com',
      isActive: true,
    });

    expect(db.run).toHaveBeenCalledTimes(1);
    const [sql, params] = db.run.mock.calls[0];
    expect(String(sql)).toContain('INSERT INTO partners');
    expect(params[0]).toBe('uuid-1');
    expect(params[6]).toBe(JSON.stringify({ tier: 'GOLD' }));
  });

  it('rejects invalid partner type', async () => {
    await load();
    const db = createFakeDb();
    const svc = new PartnerServiceClass({ db });

    await expect(
      svc.createPartner({
        name: 'Bad Partner',
        partnerType: 'NOT_A_TYPE',
      })
    ).rejects.toMatchObject({ errorCode: 'INVALID_PARTNER_TYPE' });
  });

  it('reads partner by id (db.get + parse metadata)', async () => {
    await load();
    const db = createFakeDb({
      getRow: () => ({
        id: 'p-1',
        name: 'Partner One',
        partner_type: PARTNER_TYPES.SALES,
        email: null,
        contact_name: null,
        default_revenue_share_percent: 10,
        metadata: JSON.stringify({ notes: 'x' }),
        is_active: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });
    const svc = new PartnerServiceClass({ db });
    const p = await svc.getPartner('p-1');

    expect(p).toMatchObject({
      id: 'p-1',
      partner_type: PARTNER_TYPES.SALES,
      isActive: true,
      metadata: { notes: 'x' },
    });
  });
});
