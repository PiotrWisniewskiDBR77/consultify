import { describe, expect, it } from 'vitest';
import { buildFixturePlan, stableTextId, stableUuid } from '../../../scripts/acceptance-fixtures/fixturePlan';
import { assertTarget } from '../../../scripts/acceptance-fixtures/run';
import { buildGoldenChildPlan } from '../../../scripts/acceptance-fixtures/goldenChildPlan';

const ctx={organizationId:'a3e05d4a-5397-419d-b486-8e44366c0063',userId:'owner-1'};
describe('demo acceptance fixtures safety contract',()=>{
  it('uses deterministic IDs and covers every requested domain',()=>{
    expect(stableTextId(ctx,'case')).toBe(stableTextId(ctx,'case'));
    expect(stableUuid(ctx,'kpi')).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Set(buildFixturePlan(ctx).map(x=>x.domain))).toEqual(new Set(['case','shared','kpi','roi','okr','finance','artifact','ideas']));
  });
  it('contains no destructive SQL and every row has tenant-scoped readback',()=>{
    for(const item of [...buildFixturePlan(ctx),...buildGoldenChildPlan(ctx)]){ expect(item.sql).not.toMatch(/\b(delete|truncate|drop|alter)\b/i); expect(item.sql).toMatch(/ON CONFLICT/i); expect(item.verifySql).toMatch(/organization_id\s*=\s*\$2/); }
  });
  it('covers required golden child surfaces',()=>{
    expect(buildGoldenChildPlan(ctx).map(x=>x.domain)).toEqual(expect.arrayContaining(['kpi-version','kpi-measurement','kpi-deviation','kpi-scorecard','roi-baseline','roi-pir','okr-objective','okr-kr','okr-checkin','ideas-map','ideas-business-case','ideas-financial-case','artifact-workbook','artifact-workbook-version','artifact-document-approval','artifact-document-version','finance-valuation']));
  });
  it('fails closed outside demo and requires a distinct write token',()=>{
    expect(()=>assertTarget({DATABASE_URL:'postgres://x',RAILWAY_ENVIRONMENT_NAME:'production'},false)).toThrow(/Production/);
    expect(()=>assertTarget({DATABASE_URL:'postgres://x',RAILWAY_ENVIRONMENT_NAME:'demo'},true)).toThrow(/confirmation/);
    expect(()=>assertTarget({DATABASE_URL:'postgres://x',RAILWAY_ENVIRONMENT_NAME:'demo',ACCEPTANCE_FIXTURES_CONFIRM:'SEED_DEMO_ACCEPTANCE_FIXTURES'},true)).not.toThrow();
  });
});
