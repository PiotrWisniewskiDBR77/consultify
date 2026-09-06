import crypto from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { planNiepasujace } from '../../../scripts/higiena-wlasciciela/niepasujace.js';

const url=process.env.DATABASE_URL;
const enabled=Boolean(url?.includes('127.0.0.1:54400/consultify_noc'));
describe.skipIf(!enabled)('niepasujace.ts tenant isolation · RealPG',()=>{
  const pool=new Pool({connectionString:url});let c:any;const owner=crypto.randomUUID(),other=crypto.randomUUID();
  beforeAll(async()=>{c=await pool.connect();await c.query('BEGIN');await c.query(`INSERT INTO organizations(id,name) VALUES ($1,$2),($3,$4)`,[owner,'__NIEPASUJACE_OWNER__',other,'__NIEPASUJACE_OTHER__']);const old=new Date(Date.now()-100*864e5);await c.query(`INSERT INTO tasks(id,organization_id,title,status,created_at) VALUES ($1,$2,'','TODO',$5),($3,$4,'','TODO',$5)`,[crypto.randomUUID(),owner,crypto.randomUUID(),other,old]);});
  afterAll(async()=>{if(c){await c.query('ROLLBACK');c.release()}await pool.end()});
  it('plan obejmuje wyłącznie organizację właściciela',async()=>{const p=await planNiepasujace(c,owner);expect(p.filter(x=>x.table==='tasks')).toHaveLength(1);expect(p.some(x=>x.row.organization_id===other)).toBe(false)});
  it('mutacja: wyłączenie filtra organization_id daje obserwowalne RED',async()=>{const mutant=await c.query(`SELECT organization_id FROM tasks WHERE title='' AND organization_id=ANY($1)`,[[owner,other]]);expect(mutant.rows.some((x:any)=>x.organization_id===other)).toBe(true)});
});
