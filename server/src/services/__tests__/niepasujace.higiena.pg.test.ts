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

  it('ocena 100% DRD (assessments) NIE trafia do planu — regresja b901d4a3…',async()=>{
    const id=crypto.randomUUID();
    const areas=Object.fromEntries(Array.from({length:39},(_,i)=>[`A${i+1}`,{achievedLevel:3,targetLevel:6}]));
    await c.query(`INSERT INTO assessments(id,organization_id,name,status,answers_json,completion_percent,created_at) VALUES ($1,$2,$3,'APPROVED',$4,'100',now())`,
      [id,owner,'DRD Assessment - regresja test',JSON.stringify({drd:{areas}})]);
    const p=await planNiepasujace(c,owner);
    expect(p.some(x=>x.table==='assessments'&&x.row.id===id)).toBe(false);
  });

  it('mutacja: stara reguła SQL (sprzed naprawy) błędnie kwalifikowałaby ocenę z innym kształtem JSON-a mimo completion_percent=100 → RED',async()=>{
    const id=crypto.randomUUID();
    // Ten sam realny przypadek co b901d4a3…: rekord kompletny (completion_percent=100),
    // ale bez owijki 'drd' (inny/starszy kształt zapisu) — stara reguła SQL widziała same
    // NULL-e na ścieżkach jsonb i uznawała ocenę za pustą.
    const answersJson=JSON.stringify({areas:{A1:{achievedLevel:3}},meta:{savedBy:'legacy-importer'}});
    await c.query(`INSERT INTO assessments(id,organization_id,name,status,answers_json,completion_percent,created_at) VALUES ($1,$2,$3,'APPROVED',$4,'100',now())`,
      [id,owner,'DRD Assessment - stary kształt',answersJson]);
    const oldRule=await c.query(
      `SELECT id FROM assessments WHERE id=$1 AND organization_id=$2 AND lower(coalesce(status,''))<>'archived' AND CASE WHEN answers_json IS NULL OR trim(answers_json)='' THEN true ELSE coalesce(answers_json::jsonb->'drd'->'areas',answers_json::jsonb->'siri'->'dimensions',answers_json::jsonb->'adma'->'dimensions','{}'::jsonb)='{}'::jsonb END`,
      [id,owner]);
    expect(oldRule.rows.length).toBe(1); // MUTACJA: stara reguła kwalifikuje ten wiersz do usunięcia — RED
    const p=await planNiepasujace(c,owner);
    expect(p.some(x=>x.table==='assessments'&&x.row.id===id)).toBe(false); // naprawiona reguła: zostaje
  });
});
