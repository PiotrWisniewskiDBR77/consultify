#!/usr/bin/env tsx
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PoolClient } from 'pg';
import {
  columns, qi, readManifest, restore, runMain, writeBackupCsv, writeManifest,
  type Manifest, type ManifestEntry, type Mode,
} from './wspolne.js';

type Candidate = {
  group: 'C' | 'D'; table: string; idColumn: string; row: Record<string, unknown>;
  title: string; date: string; reason: string; action: 'archive' | 'delete' | 'decision';
  archiveSql?: string; dependencies: Dependency[];
};
type Dependency = { table: string; column: string; idColumn: string; rows: Record<string, unknown>[] };

// Pomiar repo nie wykazał jednoznacznej klasy C w 105 niepustych tabelach DBR77.
// Lista pozostaje jawna: nie wolno awansować tabeli do DELETE na podstawie samej nazwy.
export const ORPHAN_TABLES: readonly string[] = [];
const ROUND1_BUG_PREFIXES = ['db9c4193', '5a8b614b'] as const;
const SUPPORTED_OUTPUT_TYPES = new Set(['document', 'presentation', 'report', 'spreadsheet']);

async function primaryKey(c: PoolClient, table: string): Promise<string | null> {
  const r = await c.query<{ column_name: string }>(
    `SELECT a.attname column_name FROM pg_constraint k
     JOIN pg_class t ON t.oid=k.conrelid
     JOIN unnest(k.conkey) WITH ORDINALITY x(attnum,ord) ON true
     JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=x.attnum
     WHERE k.contype='p' AND t.relname=$1 ORDER BY x.ord LIMIT 1`, [table]
  );
  return r.rows[0]?.column_name ?? null;
}

async function dependencies(c: PoolClient, table: string, idColumn: string, id: string): Promise<Dependency[]> {
  const fks = await c.query<{ child: string; child_col: string; parent_col: string }>(
    `SELECT child.relname child,ca.attname child_col,pa.attname parent_col
     FROM pg_constraint k JOIN pg_class child ON child.oid=k.conrelid JOIN pg_class parent ON parent.oid=k.confrelid
     JOIN unnest(k.conkey) WITH ORDINALITY ck(attnum,ord) ON true
     JOIN unnest(k.confkey) WITH ORDINALITY pk(attnum,ord) ON pk.ord=ck.ord
     JOIN pg_attribute ca ON ca.attrelid=child.oid AND ca.attnum=ck.attnum
     JOIN pg_attribute pa ON pa.attrelid=parent.oid AND pa.attnum=pk.attnum
     WHERE k.contype='f' AND parent.relname=$1 AND pa.attname=$2`, [table, idColumn]
  );
  const out: Dependency[] = [];
  for (const fk of fks.rows) {
    const idCol = await primaryKey(c, fk.child);
    if (!idCol) continue;
    const rows = (await c.query(`SELECT * FROM ${qi(fk.child)} WHERE ${qi(fk.child_col)}::text=$1`, [id])).rows;
    if (rows.length) out.push({ table: fk.child, column: fk.child_col, idColumn: idCol, rows });
  }
  return out;
}

async function addRows(c: PoolClient, out: Candidate[], cfg: {
  table: string; id: string; where: string; params?: unknown[]; title: string; date: string;
  reason: string; archiveSql?: string;
}) {
  if (!(await columns(c, cfg.table)).length) return;
  const rows = (await c.query(`SELECT * FROM ${qi(cfg.table)} WHERE organization_id=$1 AND (${cfg.where})`,
    [cfg.params?.[0], ...(cfg.params?.slice(1) ?? [])])).rows;
  for (const row of rows) {
    const deps = await dependencies(c, cfg.table, cfg.id, String(row[cfg.id]));
    out.push({ group: 'D', table: cfg.table, idColumn: cfg.id, row,
      title: String(row[cfg.title] ?? '—'), date: String(row[cfg.date] ?? '—'), reason: cfg.reason,
      action: cfg.archiveSql ? 'archive' : deps.length ? 'decision' : 'delete', archiveSql: cfg.archiveSql, dependencies: deps });
  }
}

export async function planNiepasujace(c: PoolClient, organizationId: string): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (const table of ORPHAN_TABLES) {
    const id = await primaryKey(c, table); if (!id) continue;
    const rows = (await c.query(`SELECT * FROM ${qi(table)} WHERE organization_id=$1`, [organizationId])).rows;
    for (const row of rows) { const deps=await dependencies(c,table,id,String(row[id])); out.push({group:'C',table,idColumn:id,row,title:'—',date:String(row.created_at??'—'),reason:'tabela-sierota: zapis bez rozstrzygniętego konsumenta UI',action:deps.length?'decision':'delete',dependencies:deps}); }
  }
  await addRows(c,out,{table:'initiatives',id:'id',where:`coalesce(nullif(trim(coalesce(title,name,'')),''),'')='' AND archived_at IS NULL`,params:[organizationId],title:'name',date:'created_at',reason:'inicjatywa bez tytułu',archiveSql:`archived_at=now(),updated_at=now()`});
  await addRows(c,out,{table:'assessments',id:'id',where:`lower(coalesce(status,''))<>'archived' AND CASE WHEN answers_json IS NULL OR trim(answers_json)='' THEN true ELSE coalesce(answers_json::jsonb->'drd'->'areas',answers_json::jsonb->'siri'->'dimensions',answers_json::jsonb->'adma'->'dimensions','{}'::jsonb)='{}'::jsonb END`,params:[organizationId],title:'name',date:'created_at',reason:'ocena SIRI/ADMA/DRD z zerem obszarów widocznych dla ekranu',archiveSql:`status='ARCHIVED',updated_at=now()`});
  await addRows(c,out,{table:'meetings',id:'id',where:`nullif(trim(coalesce(start_at,'')),'') IS NULL AND lower(coalesce(status,''))<>'cancelled'`,params:[organizationId],title:'title',date:'created_at',reason:'spotkanie bez daty',archiveSql:`status='cancelled',updated_at=now()`});
  await addRows(c,out,{table:'tasks',id:'id',where:`created_at < now()-interval '90 days' AND (nullif(trim(coalesce(title,'')),'') IS NULL OR coalesce(owner_id,assignee_id,created_by) IS NULL)`,params:[organizationId],title:'title',date:'created_at',reason:'zadanie bez tytułu lub właściciela starsze niż 90 dni'});
  await addRows(c,out,{table:'conversations',id:'id',where:`coalesce(archived,false)=false AND NOT EXISTS (SELECT 1 FROM conversation_messages m WHERE m.conversation_id=conversations.id)`,params:[organizationId],title:'title',date:'created_at',reason:'wątek czatu bez wiadomości',archiveSql:`archived=true,updated_at=now()`});
  await addRows(c,out,{table:'v8_output_artifacts',id:'artifact_id',where:`coalesce(delivery_state,'')<>'archived' AND NOT (output_type=ANY($2::text[]))`,params:[organizationId,[...SUPPORTED_OUTPUT_TYPES]],title:'title_snapshot',date:'created_at',reason:'typ artefaktu nieobsługiwany przez rejestr kart N',archiveSql:`delivery_state='archived',last_transition_at=now()::text`});
  const bugRows=(await c.query(`SELECT * FROM tasks WHERE organization_id=$1 AND (${ROUND1_BUG_PREFIXES.map((_,i)=>`id::text LIKE $${i+2}`).join(' OR ')})`,[organizationId,...ROUND1_BUG_PREFIXES.map(x=>`${x}%`)])).rows;
  for(const row of bugRows){if(out.some(x=>x.table==='tasks'&&x.row.id===row.id))continue;const deps=await dependencies(c,'tasks','id',String(row.id));const safe=deps.every(x=>x.table==='decisions');out.push({group:'D',table:'tasks',idColumn:'id',row,title:String(row.title??'—'),date:String(row.created_at??'—'),reason:`BUG z rundy 1; zależności ${safe?'rozwiązane kopią CSV i usunięciem':'niejednoznaczne'}: ${deps.map(x=>x.table).join(', ')||'brak'}`,action:safe?'delete':'decision',dependencies:deps});}
  return out;
}

export async function mainNiepasujace(c:PoolClient,org:{id:string;name:string},mode:Mode){
  if(mode.kind==='rollback'){const m=readManifest(mode.manifest!,'niepasujace');if(m.organizationId!==org.id)throw new Error('Manifest innej organizacji');await c.query('BEGIN');try{const n=await restore(c,m);await c.query('COMMIT');console.log(`PRZYWRÓCONE: ${n}`)}catch(e){await c.query('ROLLBACK');throw e}return;}
  const plan=await planNiepasujace(c,org.id);
  for(const group of ['C','D'] as const){console.log(`(${group}) ${group==='C'?'TABELE-SIEROTY':'REKORDY ODRZUCANE PRZEZ EKRAN'}`);const xs=plan.filter(x=>x.group===group);if(!xs.length)console.log('0');for(const x of xs)console.log(`${x.table} · ${x.row[x.idColumn]} · ${x.title} · ${x.date} · ${x.reason}${x.action==='decision'?` · DO DECYZJI (${x.dependencies.reduce((n,d)=>n+d.rows.length,0)} zależności: ${x.dependencies.map(d=>d.table).join(', ')})`:''}`);}
  console.log(`ZNALEZIONE: C=${plan.filter(x=>x.group==='C').length}; D=${plan.filter(x=>x.group==='D').length}; do decyzji=${plan.filter(x=>x.action==='decision').length}`);if(mode.kind==='dry-run')return;
  const actionable=plan.filter(x=>x.action!=='decision');const backups=new Map<string,string>();
  const backup=(table:string,rows:Record<string,unknown>[])=>{if(!rows.length)return;const old=backups.get(table);if(old)return old;const p=writeBackupCsv(table,rows);backups.set(table,p);return p;};
  const grouped=new Map<string,Record<string,unknown>[]>();for(const x of actionable){grouped.set(x.table,[...(grouped.get(x.table)??[]),x.row]);if(x.action==='delete')for(const d of x.dependencies)grouped.set(d.table,[...(grouped.get(d.table)??[]),...d.rows]);}for(const [t,rows] of grouped)backup(t,rows);
  const entries:ManifestEntry[]=[];await c.query('BEGIN');try{for(const x of actionable){
    if(x.action==='delete')for(const d of x.dependencies)for(const row of d.rows){const id=String(row[d.idColumn]);const q=await c.query(`DELETE FROM ${qi(d.table)} WHERE ${qi(d.idColumn)}::text=$1 RETURNING *`,[id]);if(q.rowCount)entries.push({table:d.table,idColumn:d.idColumn,id,action:'delete',before:row,backupCsv:backups.get(d.table)});}
    const id=String(x.row[x.idColumn]);if(x.action==='archive'){const q=await c.query(`UPDATE ${qi(x.table)} SET ${x.archiveSql} WHERE organization_id=$1 AND ${qi(x.idColumn)}::text=$2 RETURNING *`,[org.id,id]);if(q.rowCount)entries.push({table:x.table,idColumn:x.idColumn,id,action:'archive',before:x.row,backupCsv:backups.get(x.table)});}else{const q=await c.query(`DELETE FROM ${qi(x.table)} WHERE organization_id=$1 AND ${qi(x.idColumn)}::text=$2 RETURNING *`,[org.id,id]);if(q.rowCount)entries.push({table:x.table,idColumn:x.idColumn,id,action:'delete',before:x.row,backupCsv:backups.get(x.table)});}
  }await c.query('COMMIT')}catch(e){await c.query('ROLLBACK');throw e}
  const m:Manifest={version:1,script:'niepasujace',organizationId:org.id,organizationName:org.name,createdAt:new Date().toISOString(),entries};console.log(`ZMIENIONE: ${entries.length}; manifest: ${writeManifest('niepasujace',m)}`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))runMain('niepasujace',mainNiepasujace).catch(e=>{console.error(e);process.exitCode=1});
