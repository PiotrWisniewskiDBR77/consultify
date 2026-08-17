/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { enqueueOperationalAlertRepairIntent, reconstructTerminalOperationalAlertIntents, redriveOperationalAlertRepairIntent, runOperationalAlertRepairTick } from '../operationalAlertRepairService.js';

const url=process.env.DATABASE_URL??''; const enabled=process.env.RUN_DB_TESTS==='1'&&process.env.MOCK_DB==='false';
const prefix=`ops-repair-${randomUUID()}`, org=`${prefix}-org`;
const input={organizationId:org,actorId:`${prefix}-actor`,correlationId:`${prefix}-corr`,sourceType:'test_terminal',sourceTerminalId:`${prefix}-terminal`,kind:'WRITE_FAILURE_RATE' as const,outcome:'FAILURE' as const};

describe.skipIf(!enabled)('OPS durable missed-signal repair realPG',()=>{
  beforeAll(()=>{process.env.OPERATIONAL_ALERT_DURABLE_ENABLED='true';process.env.OPERATIONAL_ALERT_REPAIR_ENABLED='true';});
  afterAll(async()=>{delete process.env.OPERATIONAL_ALERT_DURABLE_ENABLED;delete process.env.OPERATIONAL_ALERT_REPAIR_ENABLED;const db=new Client({connectionString:url});await db.connect();await db.query(`ALTER TABLE operational_alert_delivery_receipts DISABLE TRIGGER trg_operational_alert_receipts_immutable`);await db.query(`DELETE FROM operational_alert_delivery_receipts WHERE organization_id=$1`,[org]);await db.query(`ALTER TABLE operational_alert_delivery_receipts ENABLE TRIGGER trg_operational_alert_receipts_immutable`);await db.query(`DELETE FROM operational_alert_delivery_outbox WHERE organization_id=$1`,[org]);await db.query(`ALTER TABLE operational_alert_repair_receipts DISABLE TRIGGER trg_operational_alert_repair_receipts_immutable`);await db.query(`DELETE FROM operational_alert_repair_receipts WHERE organization_id=$1`,[org]);await db.query(`ALTER TABLE operational_alert_repair_receipts ENABLE TRIGGER trg_operational_alert_repair_receipts_immutable`);await db.query(`DELETE FROM operational_alert_repair_intents WHERE organization_id=$1`,[org]);await db.query(`ALTER TABLE operational_alert_signals DISABLE TRIGGER trg_operational_alert_signals_immutable`);await db.query(`DELETE FROM operational_alert_signals WHERE organization_id=$1`,[org]);await db.query(`ALTER TABLE operational_alert_signals ENABLE TRIGGER trg_operational_alert_signals_immutable`);await db.end();});
  it('collapses 8-way intent, rejects collision, repairs exactly one signal and cold-reads receipt',async()=>{
    const intents=await Promise.all(Array.from({length:8},()=>enqueueOperationalAlertRepairIntent(input)));expect(new Set(intents.map(i=>i.intent_id)).size).toBe(1);
    await expect(enqueueOperationalAlertRepairIntent({...input,actorId:'different'})).rejects.toThrow('OPS_ALERT_REPAIR_COLLISION');
    expect(await runOperationalAlertRepairTick({workerId:`${prefix}-worker`})).toMatchObject({claimed:1,completed:1,failed:0});
    expect(await runOperationalAlertRepairTick({workerId:`${prefix}-worker2`})).toMatchObject({claimed:0,completed:0});
    const cold=new Client({connectionString:url});await cold.connect();const rows=await cold.query(`SELECT i.status,r.signal_id,s.organization_id FROM operational_alert_repair_intents i JOIN operational_alert_repair_receipts r USING(intent_id) JOIN operational_alert_signals s ON s.signal_id=r.signal_id WHERE i.organization_id=$1`,[org]);expect(rows.rows).toHaveLength(1);expect(rows.rows[0]).toMatchObject({status:'COMPLETED',organization_id:org});await cold.end();
  });
  it('reclaims a stale lease and reconstructs a terminal notification without replaying delivery',async()=>{
    const stale=await enqueueOperationalAlertRepairIntent({...input,sourceTerminalId:`${prefix}-stale`,correlationId:`${prefix}-stale`});
    const db=new Client({connectionString:url});await db.connect();
    await db.query(`UPDATE operational_alert_repair_intents SET status='PROCESSING',lease_owner='crashed',lease_expires_at=now()-interval '1 second' WHERE intent_id=$1`,[stale.intent_id]);
    expect(await runOperationalAlertRepairTick({workerId:`${prefix}-reclaim`})).toMatchObject({claimed:1,completed:1});
    const id=`${prefix}-notification`;await db.query(`INSERT INTO notification_outbox(id,user_id,organization_id,type,payload_json,status,dedupe_key) VALUES($1,$2,$3,'test','{}','SENT',$4)`,[id,`${prefix}-user`,org,id]);
    expect(await reconstructTerminalOperationalAlertIntents()).toBeGreaterThanOrEqual(1);
    expect(await runOperationalAlertRepairTick({workerId:`${prefix}-reconstruct`})).toMatchObject({completed:1});
    const proof=await db.query(`SELECT n.status notification_status,i.status,r.signal_id FROM notification_outbox n JOIN operational_alert_repair_intents i ON i.source_terminal_id=n.id JOIN operational_alert_repair_receipts r USING(intent_id) WHERE n.id=$1`,[id]);
    expect(proof.rows).toHaveLength(1);expect(proof.rows[0]).toMatchObject({notification_status:'SENT',status:'COMPLETED'});
    expect((await db.query(`SELECT count(*)::int n FROM operational_alert_signals WHERE organization_id=$1 AND source_id=$2`,[org,id])).rows[0].n).toBe(1);await db.end();
  });
  it('bounds retries, dead-letters and supports deliberate redrive',async()=>{
    const intent=await enqueueOperationalAlertRepairIntent({...input,sourceTerminalId:`${prefix}-dlq`,correlationId:`${prefix}-dlq`});
    const db=new Client({connectionString:url});await db.connect();await db.query(`UPDATE operational_alert_repair_intents SET max_attempts=2 WHERE intent_id=$1`,[intent.intent_id]);
    await db.query(`ALTER TABLE operational_alert_signals RENAME TO operational_alert_signals_unavailable`);
    try {
      expect(await runOperationalAlertRepairTick({workerId:`${prefix}-fail1`})).toMatchObject({failed:1,deadLettered:0});
      await db.query(`UPDATE operational_alert_repair_intents SET available_at=now() WHERE intent_id=$1`,[intent.intent_id]);
      expect(await runOperationalAlertRepairTick({workerId:`${prefix}-fail2`})).toMatchObject({failed:1,deadLettered:1});
    } finally {await db.query(`ALTER TABLE operational_alert_signals_unavailable RENAME TO operational_alert_signals`);}
    expect(await redriveOperationalAlertRepairIntent(intent.intent_id)).toMatchObject({status:'PENDING',attempt_count:0});
    expect(await runOperationalAlertRepairTick({workerId:`${prefix}-redrive`})).toMatchObject({completed:1});await db.end();
  });
});
