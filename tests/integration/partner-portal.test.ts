import { describe, expect, it } from 'vitest';

import { PARTNER_TYPES, PartnerServiceClass } from '../../server/src/services/partnerService.js';

type Db = {
  all: (sql: string, params: unknown[], cb: (err: Error | null, rows?: unknown) => void) => void;
  get: (sql: string, params: unknown[], cb: (err: Error | null, row?: unknown) => void) => void;
  run: (
    sql: string,
    params: unknown[],
    cb: (this: { lastID?: number; changes: number }, err: Error | null) => void
  ) => void;
};

function makeDb(
  overrides?: Partial<{
    onAll: (sql: string, params: unknown[]) => unknown[];
    onGet: (sql: string, params: unknown[]) => unknown | null;
    onRun: (sql: string, params: unknown[]) => { lastID?: number; changes: number };
  }>
): { db: Db; calls: { all: any[]; get: any[]; run: any[] } } {
  const calls = { all: [] as any[], get: [] as any[], run: [] as any[] };
  const db: Db = {
    all: (sql, params, cb) => {
      calls.all.push([sql, params]);
      const rows = overrides?.onAll?.(sql, params) ?? [];
      cb(null, rows);
    },
    get: (sql, params, cb) => {
      calls.get.push([sql, params]);
      const row = overrides?.onGet?.(sql, params) ?? null;
      cb(null, row as any);
    },
    run: function (sql, params, cb) {
      calls.run.push([sql, params]);
      const result = overrides?.onRun?.(sql, params) ?? { changes: 1 };
      cb.call({ lastID: result.lastID, changes: result.changes }, null);
    },
  };
  return { db, calls };
}

describe('Partner Portal (PartnerService) - REAL_CODE', () => {
  it('createPartner rejects missing required fields', async () => {
    const { db } = makeDb();
    const service = new PartnerServiceClass({ db: db as any });

    await expect(
      service.createPartner({ name: '', partnerType: PARTNER_TYPES.REFERRAL } as any)
    ).rejects.toEqual(expect.objectContaining({ errorCode: 'MISSING_REQUIRED' }));
  });

  it('createPartner rejects invalid partnerType', async () => {
    const { db } = makeDb();
    const service = new PartnerServiceClass({ db: db as any });

    await expect(service.createPartner({ name: 'X', partnerType: 'NOPE' as any })).rejects.toEqual(
      expect.objectContaining({ errorCode: 'INVALID_PARTNER_TYPE' })
    );
  });

  it('createPartner inserts metadata JSON into DB', async () => {
    const { db, calls } = makeDb();
    const service = new PartnerServiceClass({ db: db as any });

    const created = await service.createPartner({
      name: 'Acme',
      partnerType: PARTNER_TYPES.RESELLER,
      metadata: { source: 'test' },
    });

    expect(created.name).toBe('Acme');
    expect(calls.run).toHaveLength(1);
    const [sql, params] = calls.run[0];
    expect(String(sql)).toContain('INSERT INTO partners');
    expect(params).toEqual(
      expect.arrayContaining(['Acme', PARTNER_TYPES.RESELLER, JSON.stringify({ source: 'test' })])
    );
  });

  it('getPartner parses metadata JSON and maps isActive', async () => {
    const { db } = makeDb({
      onGet: () => ({
        id: 'p-1',
        name: 'Partner',
        partner_type: PARTNER_TYPES.SALES,
        email: null,
        contact_name: null,
        default_revenue_share_percent: 10,
        metadata: JSON.stringify({ tier: 'gold' }),
        is_active: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }),
    });
    const service = new PartnerServiceClass({ db: db as any });

    const partner = await service.getPartner('p-1');
    expect(partner).toEqual(
      expect.objectContaining({
        id: 'p-1',
        metadata: { tier: 'gold' },
        isActive: false,
      })
    );
  });

  it('getPartners applies filters and returns mapped rows', async () => {
    const { db, calls } = makeDb({
      onAll: () => [
        {
          id: 'p-2',
          name: 'B',
          partner_type: PARTNER_TYPES.REFERRAL,
          default_revenue_share_percent: 10,
          metadata: null,
          is_active: 1,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    const service = new PartnerServiceClass({ db: db as any });

    const rows = await service.getPartners({
      partnerType: PARTNER_TYPES.REFERRAL,
      isActive: true,
      limit: 5,
      offset: 10,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.isActive).toBe(true);
    const [sql, params] = calls.all[0];
    expect(String(sql)).toContain('partner_type = ?');
    expect(String(sql)).toContain('is_active = ?');
    expect(String(sql)).toContain('LIMIT ?');
    expect(String(sql)).toContain('OFFSET ?');
    expect(params).toEqual([PARTNER_TYPES.REFERRAL, 1, 5, 10]);
  });
});
