import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  consumeNextInitiativeExecutionEvent,
  redriveInitiativeExecutionDeadLetter,
} from '../initiativeExecutionOutboxConsumer.js';

const REAL_PG=process.env.RUN_DB_TESTS==='1'&&process.env.MOCK_DB==='false';
const DATABASE_URL=process.env.DATABASE_URL||'';

describe.skipIf(!REAL_PG)('EXE-FLOW material-command outbox consumer',()=>{
  const run=randomUUID();
  const orgA=`exe-flow-a-${run}`;
  const orgB=`exe-flow-b-${run}`;
  let db:Client;

  async function insertEvent(org:string,suffix:string,overrides=''){
    const result=await db.query<{id:string}>(
      `INSERT INTO ie_outbox_events
       (organization_id,aggregate_type,aggregate_id,aggregate_version,event_type,
        correlation_id,causation_id,payload_json ${overrides?', '+overrides.split('=')[0]:''})
       VALUES($1,'initiative',$2,1,'initiative.handoff.accepted',$3,$4,$5::jsonb
        ${overrides?', '+overrides.split('=')[1]:''}) RETURNING id::text`,
      [org,`initiative-${run}-${suffix}`,`corr-${run}-${suffix}`,`cause-${run}-${suffix}`,
       JSON.stringify({initiativeId:`initiative-${run}-${suffix}`,schemaVersion:1})]
    );
    return result.rows[0].id;
  }

  beforeAll(async()=>{
    db=new Client({connectionString:DATABASE_URL});await db.connect();
    await db.query(`INSERT INTO organizations(id,name) VALUES($1,$1),($2,$2)`,[orgA,orgB]);
  });
  afterAll(async()=>{
    if(!db)return;
    await db.query('ALTER TABLE ie_outbox_delivery_receipts DISABLE TRIGGER USER');
    await db.query('DELETE FROM ie_outbox_delivery_receipts WHERE organization_id=ANY($1)',[[orgA,orgB]]);
    await db.query('ALTER TABLE ie_outbox_delivery_receipts ENABLE TRIGGER USER');
    await db.query('DELETE FROM ie_outbox_events WHERE organization_id=ANY($1)',[[orgA,orgB]]);
    await db.query('DELETE FROM organizations WHERE id=ANY($1)',[[orgA,orgB]]);
    await db.end();
  });

  it('claims tenant-scoped exactly once under 8-way concurrency and persists immutable receipt',async()=>{
    const eventA=await insertEvent(orgA,'concurrent');
    const eventB=await insertEvent(orgB,'foreign');
    const outcomes=await Promise.all(Array.from({length:8},()=>consumeNextInitiativeExecutionEvent({organizationId:orgA})));
    expect(outcomes.filter((v)=>v?.status==='DELIVERED')).toHaveLength(1);
    expect(outcomes.find(Boolean)?.eventId).toBe(eventA);
    const receipt=await db.query(`SELECT * FROM ie_outbox_delivery_receipts WHERE source_event_id=$1`,[eventA]);
    expect(receipt.rows).toHaveLength(1);
    expect(receipt.rows[0].payload_version).toBe(1);
    expect((await db.query(`SELECT processed_at FROM ie_outbox_events WHERE id=$1`,[eventB])).rows[0].processed_at).toBeNull();
    await expect(db.query(`UPDATE ie_outbox_delivery_receipts SET event_type='tampered' WHERE source_event_id=$1`,[eventA])).rejects.toThrow(/immutable/);
  });

  it('reclaims stale processing and cold-reads the same receipt',async()=>{
    const event=await insertEvent(orgA,'stale');
    await db.query(`UPDATE ie_outbox_events SET processing_started_at=now()-interval '10 minutes' WHERE id=$1`,[event]);
    const outcome=await consumeNextInitiativeExecutionEvent({organizationId:orgA});
    expect(outcome).toMatchObject({eventId:event,status:'DELIVERED',replay:false});
    const cold=new Client({connectionString:DATABASE_URL});await cold.connect();
    const row=await cold.query(`SELECT r.receipt_id,e.processed_at FROM ie_outbox_delivery_receipts r JOIN ie_outbox_events e ON e.id=r.source_event_id WHERE r.source_event_id=$1`,[event]);
    await cold.end();
    expect(row.rows).toHaveLength(1);expect(row.rows[0].processed_at).not.toBeNull();
  });

  it('fails unsupported versions closed and supports tenant-scoped DLQ redrive',async()=>{
    const unsupported=await insertEvent(orgA,'unsupported');
    await db.query(`UPDATE ie_outbox_events SET payload_version=99 WHERE id=$1`,[unsupported]);
    expect(await consumeNextInitiativeExecutionEvent({organizationId:orgA})).toMatchObject({status:'DEAD_LETTER'});
    expect((await db.query(`SELECT count(*)::int n FROM ie_outbox_delivery_receipts WHERE source_event_id=$1`,[unsupported])).rows[0].n).toBe(0);

    const failed=await insertEvent(orgA,'forced');
    await db.query(`UPDATE ie_outbox_events SET max_attempts=1 WHERE id=$1`,[failed]);
    expect(await consumeNextInitiativeExecutionEvent({organizationId:orgA,__testForceFailure:new Error('forced')})).toMatchObject({status:'DEAD_LETTER'});
    expect(await redriveInitiativeExecutionDeadLetter(orgB,failed)).toBe(false);
    expect(await redriveInitiativeExecutionDeadLetter(orgA,failed)).toBe(true);
    expect(await consumeNextInitiativeExecutionEvent({organizationId:orgA})).toMatchObject({eventId:failed,status:'DELIVERED'});
  });
});
