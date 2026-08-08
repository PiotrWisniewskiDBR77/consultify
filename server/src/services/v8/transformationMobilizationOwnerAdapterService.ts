import { createHash } from 'node:crypto';
import { withPgTransaction } from '../../utils/queryHelpers.js';

type RaidItem = { type: 'risk'|'assumption'|'issue'|'dependency'; title:string; description:string; probability:'low'|'medium'|'high'; impact:'low'|'medium'|'high'|'critical'; ownerUserId:string; dueDate:string; response:string };
type Monitoring = { cadence:'daily'|'weekly'|'monthly'; timezone:string; firstRunAt:string; ownerUserId:string };
const stableId = (prefix:string, value:string) => `${prefix}-${createHash('sha256').update(value).digest('hex').slice(0,32)}`;
const nextRun = (value:string, cadence:Monitoring['cadence']) => { const d=new Date(value); cadence==='daily'?d.setUTCDate(d.getUTCDate()+1):cadence==='weekly'?d.setUTCDate(d.getUTCDate()+7):d.setUTCMonth(d.getUTCMonth()+1); return d.toISOString(); };

export async function materializeMobilizationOwners(input:{ organizationId:string; transformationCaseId:string; initiativeId:string; proposalId:string; payloadDigest:string; actorUserId:string; raidItems:RaidItem[]; monitoring:Monitoring }) {
  return withPgTransaction(async client => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext(?),hashtext(?))`,[input.organizationId,input.proposalId]);
    const prior=(await client.query<any>(`SELECT * FROM transformation_mobilization_owner_receipts WHERE organization_id=? AND proposal_id=?`,[input.organizationId,input.proposalId])).rows[0];
    if(prior){ if(prior.payload_digest!==input.payloadDigest) throw new Error('mobilization_owner_idempotency_conflict'); return { receiptId:prior.receipt_id,raidItemIds:prior.raid_item_ids_json,calendarItemIds:prior.calendar_item_ids_json,monitoringDefinitionId:prior.monitoring_definition_id,idempotentReplay:true }; }
    const authority=(await client.query(`SELECT 1 FROM transformation_cases c JOIN transformation_case_artifact_links l ON l.transformation_case_id=c.transformation_case_id AND l.organization_id=c.organization_id AND l.artifact_type='initiative' AND l.artifact_id=? WHERE c.transformation_case_id=? AND c.organization_id=? AND EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id=c.project_id AND pm.user_id=?)`,[input.initiativeId,input.transformationCaseId,input.organizationId,input.actorUserId])).rows[0];
    if(!authority) throw new Error('mobilization_owner_authority_required');
    const raidItemIds:string[]=[];
    for(const [i,item] of input.raidItems.entries()){
      const id=stableId('raid',`${input.proposalId}:${i}`); raidItemIds.push(id);
      await client.query(`INSERT INTO raid_items (id,organization_id,initiative_id,type,title,description,status,probability,impact,mitigation_plan,owner_id,due_date,created_at,updated_at) VALUES (?,?,?,UPPER(?),?,?,'OPEN',UPPER(?),UPPER(?),?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT (id) DO NOTHING`,[id,input.organizationId,input.initiativeId,item.type,item.title,item.description,item.probability,item.impact,item.response,item.ownerUserId,item.dueDate]);
    }
    const calendarItemIds:string[]=[];
    const calendarRows=(await client.query<any>(`SELECT id,'task_due' item_type,title,due_date event_date FROM tasks WHERE initiative_id=? AND organization_id=? AND due_date IS NOT NULL UNION ALL SELECT id,'initiative_milestone',name,target_date FROM initiative_milestones WHERE initiative_id=? AND organization_id=? AND target_date IS NOT NULL`,[input.initiativeId,input.organizationId,input.initiativeId,input.organizationId])).rows;
    // `due_date`/`target_date` are DATE columns, so node-postgres hands them
    // back as JS Date objects. Interpolating one straight into the template
    // produced `"Tue Sep 01 2026 ...GMT+0000"T00:00:00.000Z`, which Postgres
    // rejects — take the calendar day explicitly instead.
    const calendarDay=(value:unknown):string=>
      value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10);
    for(const row of calendarRows){ const id=stableId('cal',`${input.proposalId}:${row.item_type}:${row.id}`); calendarItemIds.push(id); await client.query(`INSERT INTO v8_calendar_items (calendar_item_id,organization_id,source_id,item_type,source_system,source_object_ref,title,start_at,end_at,all_day,timezone,visibility_class,edit_authority,recurrence_model_json,sync_state,etag,created_at,updated_at) VALUES (?,?,NULL,?,'consultify',?,?,?,NULL,1,?,'details','local_only',NULL,'in_sync',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT (calendar_item_id) DO NOTHING`,[id,input.organizationId,row.item_type,`${row.item_type}:${row.id}`,row.title,`${calendarDay(row.event_date)}T00:00:00.000Z`,input.monitoring.timezone]); }
    const monitoringDefinitionId=stableId('monitor',input.transformationCaseId);
    await client.query(`INSERT INTO transformation_monitoring_definitions (monitoring_definition_id,organization_id,transformation_case_id,initiative_id,owner_user_id,cadence,timezone,first_run_at,next_run_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT (organization_id,transformation_case_id) DO NOTHING`,[monitoringDefinitionId,input.organizationId,input.transformationCaseId,input.initiativeId,input.monitoring.ownerUserId,input.monitoring.cadence,input.monitoring.timezone,input.monitoring.firstRunAt,input.monitoring.firstRunAt]);
    const receiptId=stableId('mobilization-owner',input.proposalId);
    await client.query(`INSERT INTO transformation_mobilization_owner_receipts (receipt_id,organization_id,transformation_case_id,initiative_id,proposal_id,payload_digest,raid_item_ids_json,calendar_item_ids_json,monitoring_definition_id,created_by_user_id) VALUES (?,?,?,?,?,?,?::jsonb,?::jsonb,?,?)`,[receiptId,input.organizationId,input.transformationCaseId,input.initiativeId,input.proposalId,input.payloadDigest,JSON.stringify(raidItemIds),JSON.stringify(calendarItemIds),monitoringDefinitionId,input.actorUserId]);
    return {receiptId,raidItemIds,calendarItemIds,monitoringDefinitionId,idempotentReplay:false};
  });
}

export async function runDueMobilizationMonitoring(input:{organizationId:string;workerId:string;now?:string;leaseSeconds?:number}){
  const now=input.now??new Date().toISOString(); const leaseUntil=new Date(Date.parse(now)+(input.leaseSeconds??300)*1000).toISOString();
  return withPgTransaction(async client=>{
    const claimed=(await client.query<any>(`WITH candidate AS (SELECT monitoring_definition_id FROM transformation_monitoring_definitions WHERE organization_id=? AND status='active' AND next_run_at<=? AND (lease_expires_at IS NULL OR lease_expires_at<=?) ORDER BY next_run_at FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE transformation_monitoring_definitions d SET lease_owner=?,lease_expires_at=?,updated_at=? FROM candidate WHERE d.monitoring_definition_id=candidate.monitoring_definition_id RETURNING d.*`,[input.organizationId,now,now,input.workerId,leaseUntil,now])).rows[0];
    if(!claimed) return null;
    const snapshotId=stableId('monitor-snapshot',`${claimed.monitoring_definition_id}:${new Date(claimed.next_run_at).toISOString()}`);
    const counts=(await client.query<any>(`SELECT (SELECT COUNT(*)::int FROM tasks WHERE initiative_id=? AND organization_id=? AND UPPER(status) NOT IN ('DONE','COMPLETED')) open_tasks,(SELECT COUNT(*)::int FROM raid_items WHERE initiative_id=? AND organization_id=? AND UPPER(status) NOT IN ('CLOSED','MITIGATED')) open_raid,(SELECT COUNT(*)::int FROM initiative_milestones WHERE initiative_id=? AND organization_id=? AND UPPER(status)<>'COMPLETED') open_milestones`,[claimed.initiative_id,input.organizationId,claimed.initiative_id,input.organizationId,claimed.initiative_id,input.organizationId])).rows[0];
    await client.query(`INSERT INTO transformation_monitoring_snapshots (snapshot_id,monitoring_definition_id,organization_id,scheduled_for,snapshot_json) VALUES (?,?,?,?,?::jsonb) ON CONFLICT (monitoring_definition_id,scheduled_for) DO NOTHING`,[snapshotId,claimed.monitoring_definition_id,input.organizationId,claimed.next_run_at,JSON.stringify({...counts,readOnly:true})]);
    await client.query(`UPDATE transformation_monitoring_definitions SET next_run_at=?,last_run_at=?,lease_owner=NULL,lease_expires_at=NULL,updated_at=? WHERE monitoring_definition_id=? AND organization_id=? AND lease_owner=?`,[nextRun(claimed.next_run_at,claimed.cadence),now,now,claimed.monitoring_definition_id,input.organizationId,input.workerId]);
    return {snapshotId,monitoringDefinitionId:claimed.monitoring_definition_id,scheduledFor:claimed.next_run_at,snapshot:{...counts,readOnly:true}};
  });
}
