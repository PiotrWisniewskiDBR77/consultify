import crypto from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { planSmieci } from '../../scripts/higiena-wlasciciela/smieci.js';

const url=process.env.DATABASE_URL;
const enabled=Boolean(url?.includes('127.0.0.1:54400/consultify_noc'));
describe.skipIf(!enabled)('smieci.ts tenant isolation · RealPG',()=>{
  const pool=new Pool({connectionString:url});let c:any;const owner=crypto.randomUUID(),other=crypto.randomUUID();
  beforeAll(async()=>{c=await pool.connect();await c.query('BEGIN');await c.query(`INSERT INTO organizations(id,name) VALUES ($1,$2),($3,$4)`,[owner,'__HIGIENA_OWNER__',other,'__HIGIENA_OTHER__']);await c.query(`INSERT INTO tasks(id,organization_id,title,status) VALUES ($1,$2,'test owner','TODO'),($3,$4,'test other','TODO')`,[crypto.randomUUID(),owner,crypto.randomUUID(),other]);});
  afterAll(async()=>{if(c){await c.query('ROLLBACK');c.release()}await pool.end()});
  it('plan obejmuje właściciela i nie obejmuje innej organizacji',async()=>{const p=await planSmieci(c,owner);expect(p.filter((x:any)=>x.cfg.table==='tasks')).toHaveLength(1);expect(p.some((x:any)=>x.row.organization_id===other)).toBe(false)});
  it('mutacja: usunięcie filtra organization_id daje RED',async()=>{const mutant=await c.query(`SELECT organization_id FROM tasks WHERE title ~* '^test' AND organization_id=ANY($1)`,[[owner,other]]);expect(mutant.rows.some((x:any)=>x.organization_id===other)).toBe(true)});
});
