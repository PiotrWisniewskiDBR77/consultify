import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildFixturePlan, FINANCE_ACCEPTANCE_FLAG_KEYS, stableTextId, stableUuid } from '../../../scripts/acceptance-fixtures/fixturePlan';
import { assertOrganizationAllowlisted, assertTarget } from '../../../scripts/acceptance-fixtures/run';
import { buildGoldenChildPlan } from '../../../scripts/acceptance-fixtures/goldenChildPlan';

const ctx={organizationId:'a3e05d4a-5397-419d-b486-8e44366c0063',userId:'owner-1'};
describe('demo acceptance fixtures safety contract',()=>{
  it('uses deterministic IDs and covers every requested domain',()=>{
    expect(stableTextId(ctx,'case')).toBe(stableTextId(ctx,'case'));
    expect(stableUuid(ctx,'kpi')).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Set(buildFixturePlan(ctx).map(x=>x.domain))).toEqual(new Set(['case','shared','kpi','roi','okr','finance','artifact','ideas',...FINANCE_ACCEPTANCE_FLAG_KEYS.map(key=>`finance-flag:${key}`)]));
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
  it('requires the exact organization ID without changing organization type',()=>{
    expect(()=>assertOrganizationAllowlisted({ACCEPTANCE_ORG_ALLOWLIST:'org-a, org-b'},'org-b')).not.toThrow();
    expect(()=>assertOrganizationAllowlisted({ACCEPTANCE_ORG_ALLOWLIST:'org-a, org-b'},'org')).toThrow(/allowlist/i);
    expect(buildFixturePlan(ctx).map(item=>item.sql).join('\n')).not.toMatch(/organization_type/i);
  });
  it('upserts all Finance runtime flags for the production-filtered endpoint',()=>{
    const flags=buildFixturePlan(ctx).filter(item=>item.domain.startsWith('finance-flag:'));
    expect(flags).toHaveLength(11);
    for(const flag of flags){
      expect(flag.sql).toContain("'production'");
      expect(flag.sql).toContain('organization_id');
      expect(flag.verifySql).toContain("environment='production'");
      expect(flag.verifySql).toContain('enabled=true');
    }
  });
  it('seeds a materializable, evidence-backed presentation instead of sparse placeholders',()=>{
    const presentation=buildFixturePlan(ctx).find(item=>item.domain==='artifact');
    expect(presentation).toBeDefined();
    const unified=JSON.parse(String(presentation!.params[7]));
    expect(unified.slides).toHaveLength(6);
    expect(unified.slides.every((slide:any)=>slide.content.type===slide.intent)).toBe(true);
    expect(unified.slides.every((slide:any)=>slide.source_refs?.length>0)).toBe(true);
    expect(presentation!.sql).toContain('deck_json=NULL');
  });
  it('seeds a non-zero integrated Finance baseline for full-workspace rehearsal',()=>{
    const finance=buildFixturePlan(ctx).find(item=>item.domain==='finance');
    const assumptions=JSON.parse(String(finance!.params[5]));
    expect(assumptions.baseline.revenue).toBeGreaterThan(0);
    expect(assumptions.initialCash+assumptions.initialAR+assumptions.initialInventory+assumptions.initialPPE)
      .toBe(assumptions.initialDebt+assumptions.initialAP+assumptions.initialEquity);
    expect(finance!.sql).toContain('assumptions_json=EXCLUDED.assumptions_json');
  });
  it('documents the dedicated acceptance owner and Piotr readback without exposing a password',()=>{
    const source=readFileSync(resolve(process.cwd(),'server/scripts/acceptance-fixtures/run.ts'),'utf8');
    expect(source).toContain('acceptance.owner@consultify.local');
    expect(source).toContain("role:'OWNER',status:'active'");
    expect(source).toContain('Piotr readback must be exactly one active OWNER');
    expect(source).not.toMatch(/acceptanceOwner:\{[^}]*password/);
  });
});
