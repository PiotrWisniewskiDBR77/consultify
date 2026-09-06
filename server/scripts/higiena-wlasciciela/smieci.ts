#!/usr/bin/env tsx
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PoolClient } from 'pg';
import { dopasujWzorzec } from './wzorce.js';
import { columns, qi, readManifest, restore, runMain, writeBackupCsv, writeManifest, type Manifest, type ManifestEntry, type Mode } from './wspolne.js';

export const TABLES = [
  {table:'assessments',title:'name',id:'id',archive:`status='archived',updated_at=now()`,active:`lower(coalesce(status,''))<>'archived'`},
  {table:'initiatives',title:'name',id:'id',archive:`archived_at=now(),updated_at=now()`,active:`archived_at IS NULL`},
  {table:'meetings',title:'title',id:'id',archive:`status='cancelled',updated_at=now()`,active:`lower(coalesce(status,''))<>'cancelled'`},
  {table:'tasks',title:'title',id:'id'},
  {table:'ideas',title:'title',id:'id'},
  {table:'notebook_pages',title:'title',id:'id',archive:`status='archived',updated_at=now()`,active:`lower(coalesce(status,''))<>'archived'`},
  {table:'organization_context',title:'company_name',id:'id'},
] as const;

async function dependentCount(c:PoolClient,table:string,idCol:string,id:string):Promise<number>{
  const fks=await c.query<{child:string;col:string}>(`SELECT cl.relname child,a.attname col FROM pg_constraint k JOIN pg_class cl ON cl.oid=k.conrelid JOIN pg_class p ON p.oid=k.confrelid JOIN unnest(k.conkey) WITH ORDINALITY ck(attnum,ord) ON true JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=ck.attnum WHERE k.contype='f' AND p.relname=$1`,[table]);
  let n=0;for(const fk of fks.rows){const q=await c.query(`SELECT count(*)::int n FROM ${qi(fk.child)} WHERE ${qi(fk.col)}::text=$1`,[id]);n+=Number(q.rows[0].n)}return n;
}

export async function planSmieci(c:PoolClient,organizationId:string){
  const out:Array<{cfg:typeof TABLES[number];row:Record<string,unknown>;pattern:string;dependencies:number;decision:boolean}>=[];
  for(const cfg of TABLES){if(!(await columns(c,cfg.table)).length)continue;const active='active' in cfg?` AND ${cfg.active}`:'';const rows=(await c.query(`SELECT t.* FROM ${qi(cfg.table)} t WHERE t.organization_id=$1${active}`,[organizationId])).rows;for(const row of rows){const pattern=dopasujWzorzec(String(row[cfg.title]??''));if(!pattern)continue;const dependencies=cfg.archive?0:await dependentCount(c,cfg.table,cfg.id,String(row[cfg.id]));row.author=row.created_by??row.owner_user_id??row.owner_id??'—';out.push({cfg,row,pattern:pattern.label,dependencies,decision:!cfg.archive&&dependencies>0});}}
  return out;
}

export async function mainSmieci(c:PoolClient,org:{id:string;name:string},mode:Mode){
  if(mode.kind==='rollback'){const m=readManifest(mode.manifest!,'smieci');if(m.organizationId!==org.id)throw new Error('Manifest innej organizacji');await c.query('BEGIN');try{const n=await restore(c,m);await c.query('COMMIT');console.log(`PRZYWRÓCONE: ${n}`)}catch(e){await c.query('ROLLBACK');throw e}return}
  const plan=await planSmieci(c,org.id);for(const x of plan)console.log(`${x.cfg.table} · ${x.row[x.cfg.id]} · ${x.row[x.cfg.title]} · ${x.row.created_at??'—'} · ${x.row.author??'—'} · ${x.pattern}${x.decision?` · DO DECYZJI (${x.dependencies} zależności)`:''}`);
  console.log(`ZNALEZIONE: ${plan.length}; do decyzji: ${plan.filter(x=>x.decision).length}`);if(mode.kind==='dry-run')return;
  const actionable=plan.filter(x=>!x.decision);const byTable=new Map<string,typeof actionable>();for(const x of actionable)byTable.set(x.cfg.table,[...(byTable.get(x.cfg.table)??[]),x]);const backups=new Map<string,string>();for(const [table,xs] of byTable)backups.set(table,writeBackupCsv(table,xs.map(x=>x.row)));
  const entries:ManifestEntry[]=[];await c.query('BEGIN');try{for(const x of actionable){const id=String(x.row[x.cfg.id]);if(x.cfg.archive){const q=await c.query(`UPDATE ${qi(x.cfg.table)} SET ${x.cfg.archive} WHERE organization_id=$1 AND ${qi(x.cfg.id)}::text=$2 RETURNING *`,[org.id,id]);if(q.rowCount)entries.push({table:x.cfg.table,idColumn:x.cfg.id,id,action:'archive',before:x.row,backupCsv:backups.get(x.cfg.table)});}else{const q=await c.query(`DELETE FROM ${qi(x.cfg.table)} WHERE organization_id=$1 AND ${qi(x.cfg.id)}::text=$2 RETURNING *`,[org.id,id]);if(q.rowCount)entries.push({table:x.cfg.table,idColumn:x.cfg.id,id,action:'delete',before:x.row,backupCsv:backups.get(x.cfg.table)});}}await c.query('COMMIT')}catch(e){await c.query('ROLLBACK');throw e}
  const m:Manifest={version:1,script:'smieci',organizationId:org.id,organizationName:org.name,createdAt:new Date().toISOString(),entries};console.log(`ZMIENIONE: ${entries.length}; manifest: ${writeManifest('smieci',m)}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runMain('smieci',mainSmieci).catch(e=>{console.error(e);process.exitCode=1});
