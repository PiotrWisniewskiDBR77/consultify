#!/usr/bin/env tsx
import type { PoolClient } from 'pg';
import { readManifest, restore, runMain, writeManifest, type Manifest, type ManifestEntry } from './wspolne.js';

function filled(v: unknown): [number,number] { if (v == null || v === '') return [0,1]; if (Array.isArray(v)) return v.reduce((a,x)=>{const b=filled(x);return[a[0]+b[0],a[1]+b[1]]},[0,0]); if(typeof v==='object') return Object.values(v as object).reduce((a,x)=>{const b=filled(x);return[a[0]+b[0],a[1]+b[1]]},[0,0]); return [1,1]; }
const pct=(v:unknown)=>{try{const x=typeof v==='string'?JSON.parse(v):v;const [a,b]=filled(x);return b?100*a/b:0}catch{return 0}};

async function main(c:PoolClient,org:{id:string;name:string},mode:{kind:string;manifest?:string}) {
  if(mode.kind==='rollback'){const m=readManifest(mode.manifest!,'oceny');await c.query('BEGIN');try{const n=await restore(c,m);await c.query('COMMIT');console.log(`PRZYWRÓCONE: ${n}`)}catch(e){await c.query('ROLLBACK');throw e}return}
  const legacy=(await c.query(`SELECT a.*,coalesce(u.display_name,concat_ws(' ',u.first_name,u.last_name),u.email,a.created_by,'—') author FROM assessments a LEFT JOIN users u ON u.id=a.created_by WHERE a.organization_id=$1 AND lower(coalesce(a.status,''))<>'archived' ORDER BY a.created_at`,[org.id])).rows;
  const core=(await c.query(`SELECT s.*,coalesce(u.display_name,concat_ws(' ',u.first_name,u.last_name),u.email,s.owner_user_id,'—') author,o.current_json,o.target_json,o.gap_json,o.evidence_completeness_json FROM method_sessions s LEFT JOIN users u ON u.id=s.owner_user_id LEFT JOIN LATERAL (SELECT * FROM method_outputs x WHERE x.session_id=s.id ORDER BY output_version DESC LIMIT 1)o ON true WHERE s.organization_id=$1 AND upper(coalesce(s.state,''))<>'ARCHIVED' ORDER BY s.created_at`,[org.id])).rows;
  const rows=[...legacy.map(r=>({store:'assessments',r,completion:Number(r.completion_percent)||pct(r.answers_json),date:r.created_at,author:r.author})),...core.map(r=>({store:'method_sessions',r,completion:pct({current:r.current_json,target:r.target_json,gap:r.gap_json,evidence:r.evidence_completeness_json}),date:r.created_at,author:r.author}))];
  for(const x of rows) console.log(`${x.store} · ${x.r.id} · ${x.completion.toFixed(1)}% · ${x.date} · ${x.author}`);
  const best=rows.reduce((a,b)=>!a||b.completion>a.completion?b:a,undefined as typeof rows[number]|undefined); const cutoff=Date.now()-7*864e5;
  const candidates=rows.filter(x=>x!==best&&x.completion<10&&new Date(x.date).getTime()<cutoff);
  console.log(`PLAN: archiwizacja ${candidates.length}; najlepsza ocena nietknięta: ${best?.r.id??'brak'}; rekordy >=10% nietknięte.`);
  if(mode.kind==='dry-run')return;
  const entries:ManifestEntry[]=[];await c.query('BEGIN');try{for(const x of candidates){if(x.store==='assessments'){const q=await c.query(`UPDATE assessments SET status='archived',updated_at=now() WHERE organization_id=$1 AND id=$2 AND lower(coalesce(status,''))<>'archived' RETURNING *`,[org.id,x.r.id]);if(q.rowCount)entries.push({table:'assessments',idColumn:'id',id:x.r.id,action:'archive',before:x.r});}else{const q=await c.query(`UPDATE method_sessions SET state='ARCHIVED',updated_at=now() WHERE organization_id=$1 AND id=$2 AND upper(coalesce(state,''))<>'ARCHIVED' RETURNING *`,[org.id,x.r.id]);if(q.rowCount)entries.push({table:'method_sessions',idColumn:'id',id:x.r.id,action:'archive',before:x.r});}}await c.query('COMMIT')}catch(e){await c.query('ROLLBACK');throw e}
  const m:Manifest={version:1,script:'oceny',organizationId:org.id,organizationName:org.name,createdAt:new Date().toISOString(),entries};console.log(`ZMIENIONE: ${entries.length} · manifest: ${writeManifest('oceny',m)}`);
}
runMain('oceny',main).catch(e=>{console.error(e);process.exitCode=1});
