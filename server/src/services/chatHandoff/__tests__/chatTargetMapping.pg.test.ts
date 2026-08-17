import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerArtifactOrigin } from '../../v8/artifactRegistryService.js';
import { materializeDocumentArtifact } from '../../documentStudio/documentStudioService.js';
import { claimNextChatOwnerIngress } from '../chatTargetOwnerIngressService.js';
import { materializeClaimedChatTarget } from '../chatTargetMappingService.js';

const url=process.env.DATABASE_URL||''; const run= randomUUID();
const enabled=process.env.RUN_DB_TESTS==='1'&&url.includes('127.0.0.1');
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const stableId=(prefix:string, ingressId:string)=>`${prefix}-${createHash('sha256').update(ingressId).digest('hex').slice(0,32)}`;

describe.skipIf(!enabled)('CHAT target mappings — real PostgreSQL',()=>{
  const pool=new Pool({connectionString:url}); const org=randomUUID(), owner=randomUUID();
  const foreignOrg=randomUUID(), foreignUser=randomUUID(), revokedUser=randomUUID();
  let app:Express; let token='', ownerToken='', foreignToken='', revokedToken=''; const bearer=()=>({Authorization:`Bearer ${token}`});
  beforeAll(async()=>{await pool.query(`INSERT INTO organizations(id,name,plan,status) VALUES($1,$2,'enterprise','active')`,[org,`chat-map-${run}`]);
    await pool.query(`INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'x','OWNER','active')`,[owner,org,`${owner}@test.invalid`]);
    await pool.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE')`,[randomUUID(),org,owner]);
    await pool.query(`INSERT INTO organizations(id,name,plan,status) VALUES($1,$2,'enterprise','active')`,[foreignOrg,`chat-map-foreign-${run}`]);
    await pool.query(`INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'x','OWNER','active'),($4,$5,$6,'x','OWNER','active')`,
      [foreignUser,foreignOrg,`${foreignUser}@test.invalid`,revokedUser,org,`${revokedUser}@test.invalid`]);
    await pool.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE'),($4,$5,$6,'OWNER','REVOKED')`,
      [randomUUID(),foreignOrg,foreignUser,randomUUID(),org,revokedUser]);
    const {default:config}=await import('../../../config/Config.js');
    ownerToken=jwt.sign({id:owner,organizationId:org,role:'OWNER',email:`${owner}@test.invalid`},config.JWT_SECRET,{expiresIn:'10m'});
    foreignToken=jwt.sign({id:foreignUser,organizationId:foreignOrg,role:'OWNER',email:`${foreignUser}@test.invalid`},config.JWT_SECRET,{expiresIn:'10m'});
    revokedToken=jwt.sign({id:revokedUser,organizationId:org,role:'OWNER',email:`${revokedUser}@test.invalid`},config.JWT_SECRET,{expiresIn:'10m'});
    token=ownerToken;
    process.env.ENABLE_V8_GLOBAL='true'; const {default:v8}=await import('../../../routes/v8/index.js'); app=express();app.use(express.json());app.use('/api/v8',v8);});
  afterAll(async()=>{
    await pool.query(`ALTER TABLE chat_target_mapping_attempts DISABLE TRIGGER trg_chat_target_mapping_attempts_append_only`);
    await pool.query(`DELETE FROM chat_target_mapping_attempts WHERE organization_id=$1`,[org]);
    await pool.query(`ALTER TABLE chat_target_mapping_attempts ENABLE TRIGGER trg_chat_target_mapping_attempts_append_only`);
    await pool.query(`DELETE FROM chat_target_mapping_receipts WHERE organization_id=$1`,[org]);
    await pool.query(`DELETE FROM chat_handoff_owner_claims WHERE organization_id=$1`,[org]);
    await pool.query(`ALTER TABLE chat_handoff_owner_ingress DISABLE TRIGGER trg_chat_handoff_owner_ingress_immutable`);
    await pool.query(`DELETE FROM chat_handoff_owner_ingress WHERE organization_id=$1`,[org]);
    await pool.query(`ALTER TABLE chat_handoff_owner_ingress ENABLE TRIGGER trg_chat_handoff_owner_ingress_immutable`);
    await pool.query(`DELETE FROM artifact_handoff_receipts WHERE organization_id=$1`,[org]);
    await pool.query(`DELETE FROM artifact_handoff_proposals WHERE organization_id=$1`,[org]);
    await pool.query(`DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE organization_id=$1)`,[org]);
    await pool.query(`DELETE FROM conversations WHERE organization_id=$1`,[org]);
    await pool.query(`DELETE FROM v8_artifact_origin_links WHERE organization_id=ANY($1)`,[[org,foreignOrg]]);
    await pool.query(`DELETE FROM v8_output_artifacts WHERE organization_id=ANY($1)`,[[org,foreignOrg]]);
    await pool.query(`DELETE FROM generated_workbook_revisions WHERE organization_id=$1`,[org]);
    await pool.query(`DELETE FROM generated_workbooks WHERE organization_id=$1`,[org]);
    await pool.query(`DELETE FROM presentation_deck_versions WHERE deck_id IN (SELECT id FROM presentation_decks WHERE organization_id=$1)`,[org]);
    await pool.query(`DELETE FROM presentation_decks WHERE organization_id=$1`,[org]);
    await pool.query(`DELETE FROM wave5_artifacts WHERE organization_id=$1`,[org]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=ANY($1)`,[[org,foreignOrg]]);
    await pool.query(`DELETE FROM users WHERE id=ANY($1)`,[[owner,foreignUser,revokedUser]]);
    await pool.query(`DELETE FROM organizations WHERE id=ANY($1)`,[[org,foreignOrg]]); await pool.end();});

  async function proposal(kind:'document'|'presentation'|'workbook'|'artifact_origin',targetCommand:Record<string,unknown>){
    token=ownerToken;
    const messageId=randomUUID(), conversationId=randomUUID(); await pool.query(`INSERT INTO conversations(id,user_id,organization_id,title) VALUES($1,$2,$3,'mapping')`,[conversationId,owner,org]);
    await pool.query(`INSERT INTO conversation_messages(id,conversation_id,role,content,metadata) VALUES($1,$2,'ai',$3,'{}')`,[messageId,conversationId,`approved ${kind}`]);
    const created=await request(app).post(`/api/v8/chat/conversations/${conversationId}/handoff-proposals`).set(bearer()).send({messageId,targetKind:kind,commandSchemaVersion:'v1',targetCommand,idempotencyKey:`${run}:${kind}:${conversationId}`});
    expect(created.status, JSON.stringify(created.body)).toBe(201); const proposalId=created.body.data.proposal.proposalId;
    expect((await request(app).post(`/api/v8/chat/handoff-proposals/${proposalId}/approve`).set(bearer()).send({reason:'approved'})).status).toBe(200);
    const delivered=await request(app).post(`/api/v8/chat/handoff-proposals/${proposalId}/owner-ingress`).set(bearer()).send({}); expect(delivered.status).toBe(201);
    const claimed=await request(app).post('/api/v8/chat/handoff-owner-ingress/claim').set(bearer()).send({targetKind:kind}); expect(claimed.status).toBe(200);
    expect(claimed.body.data.ingressId).toBe(delivered.body.data.ingress.ingressId); return claimed.body.data;
  }

  const materialize=(claim:any)=>request(app).post(`/api/v8/chat/handoff-owner-ingress/${claim.ingressId}/materialize`).set(bearer()).send({claimToken:claim.claimToken});

  it('materializes deterministic DOC, PPT and XLSX owner commands with cold readback',async()=>{
    const doc=await proposal('document',{title:'Approved document',description:'Immutable approved chat bytes'});
    const docResult=await materialize(doc); expect(docResult.status).toBe(200);
    expect((await pool.query(`SELECT content_json_native FROM wave5_artifacts WHERE artifact_id=$1 AND organization_id=$2`,[docResult.body.data.targetRecordId,org])).rowCount).toBe(1);

    const ppt=await proposal('presentation',{title:'Approved deck',slides:[{title:'Decision',bullets:['One approved fact']}]});
    const pptResult=await materialize(ppt); expect(pptResult.status).toBe(200);
    expect((await pool.query(`SELECT deck_json,unified_json,version FROM presentation_decks WHERE id=$1 AND organization_id=$2`,[pptResult.body.data.targetRecordId,org])).rows[0].version).toBe(1);

    const xlsx=await proposal('workbook',{title:'Approved workbook',schema:{title:'Approved workbook',sheets:[{name:'Data',columns:[{key:'A',header:'A'}],rows:[{cells:{A:{value:'approved'}}}]}]}});
    const eight=await Promise.all(Array.from({length:8},()=>materialize(xlsx))); expect(eight.filter(x=>x.status===200)).toHaveLength(1);
    expect((await pool.query(`SELECT count(*)::int n FROM generated_workbooks WHERE organization_id=$1`,[org])).rows[0].n).toBe(1);
  },60_000);

  it('binds explicit artifact_origin hash and fails closed for ambiguous material/version drift',async()=>{
    const summary={source:'approved-existing-artifact',version:1};
    const artifact=await registerArtifactOrigin({organizationId:org,outputType:'report',artifactFamily:'document',originRuntime:'native_artifact',
      originRecordId:`origin-${run}`,createdBy:owner,ownerUserId:owner,titleSnapshot:'Existing',originSummary:summary});
    expect(artifact).not.toBeNull();
    const claim=await proposal('artifact_origin',{artifactId:artifact!.artifactId,originRuntime:'native_artifact',originRecordId:`origin-${run}`,contentHash:hash(summary)});
    const result=await materialize(claim); expect(result.status).toBe(200); expect(result.body.data.targetRecordId).toBe(artifact!.artifactId);
    await expect(pool.query(`UPDATE chat_target_mapping_attempts SET event_type='failed' WHERE organization_id=$1`,[org])).rejects.toThrow(/append-only/);
  });

  it('reclaims a crash after canonical target creation without duplicating the owner row',async()=>{
    const claim=await proposal('document',{title:'Crash-safe document',description:'reclaim'});
    await expect(materializeClaimedChatTarget({organizationId:org,ingressId:claim.ingressId,claimToken:claim.claimToken,actorUserId:owner,crashAfterTarget:true})).rejects.toThrow('injected crash');
    await pool.query(`UPDATE chat_handoff_owner_claims SET lease_expires_at=NOW()-INTERVAL '1 second' WHERE ingress_id=$1`,[claim.ingressId]);
    const reclaimed=await claimNextChatOwnerIngress({organizationId:org,targetKind:'document',claimedBy:owner}); expect(reclaimed?.attemptCount).toBe(2);
    const completed=await materializeClaimedChatTarget({organizationId:org,ingressId:claim.ingressId,claimToken:reclaimed!.claimToken,actorUserId:owner});
    expect((await pool.query(`SELECT count(*)::int n FROM wave5_artifacts WHERE artifact_id=$1 AND organization_id=$2`,[completed.targetRecordId,org])).rows[0].n).toBe(1);
  });

  it('reconciles consumed owner ingress after the shared receipt committed before mapping success',async()=>{
    const claim=await proposal('workbook',{title:'Receipt crash workbook',schema:{title:'Receipt crash workbook',sheets:[{name:'Data',columns:[{key:'A',header:'A'}],rows:[]}]}});
    await expect(materializeClaimedChatTarget({organizationId:org,ingressId:claim.ingressId,claimToken:claim.claimToken,
      actorUserId:owner,crashAfterOwnerIngress:true})).rejects.toThrow('injected crash after owner ingress');
    const before=await pool.query(`SELECT c.consumed_at,c.handoff_receipt_id,m.state FROM chat_handoff_owner_claims c
      JOIN chat_target_mapping_receipts m USING(ingress_id) WHERE c.ingress_id=$1`,[claim.ingressId]);
    expect(before.rows[0].consumed_at).not.toBeNull(); expect(before.rows[0].handoff_receipt_id).not.toBeNull();
    expect(before.rows[0].state).not.toBe('succeeded');
    const repaired=await materializeClaimedChatTarget({organizationId:org,ingressId:claim.ingressId,
      claimToken:claim.claimToken,actorUserId:owner});
    const after=await pool.query(`SELECT m.state,m.target_record_id,m.output_digest,r.target_record_id shared_target
      FROM chat_target_mapping_receipts m JOIN chat_handoff_owner_claims c USING(ingress_id)
      JOIN artifact_handoff_receipts r ON r.receipt_id=c.handoff_receipt_id WHERE m.ingress_id=$1`,[claim.ingressId]);
    expect(after.rows[0]).toMatchObject({state:'succeeded',target_record_id:repaired.targetRecordId,shared_target:repaired.targetRecordId});
    expect(after.rows[0].output_digest).toBe(repaired.outputDigest);
  });

  it('rolls back a PPT deck when crashing between deck and immutable version, then creates exactly one pair',async()=>{
    const claim=await proposal('presentation',{title:'Atomic deck',slides:[{title:'One',bullets:['Approved']}]});
    await expect(materializeClaimedChatTarget({organizationId:org,ingressId:claim.ingressId,claimToken:claim.claimToken,
      actorUserId:owner,crashAfterPresentationDeck:true})).rejects.toThrow('injected crash between deck and version');
    const deckId=stableId('chatdeck',claim.ingressId).replace(/-/g,'').slice(0,40);
    expect((await pool.query(`SELECT count(*)::int n FROM presentation_decks WHERE id=$1`,[deckId])).rows[0].n).toBe(0);
    await expect(materializeClaimedChatTarget({organizationId:org,ingressId:claim.ingressId,
      claimToken:claim.claimToken,actorUserId:owner,crashAfterTarget:true})).rejects.toThrow('injected crash after target');
    await pool.query(`UPDATE chat_handoff_owner_claims SET lease_expires_at=now()-interval '1 second' WHERE ingress_id=$1`,[claim.ingressId]);
    const reclaimed=await claimNextChatOwnerIngress({organizationId:org,targetKind:'presentation',claimedBy:owner});
    expect(reclaimed?.ingressId).toBe(claim.ingressId);
    const completed=await materializeClaimedChatTarget({organizationId:org,ingressId:claim.ingressId,
      claimToken:reclaimed!.claimToken,actorUserId:owner});
    expect(completed.targetRecordId).toBe(deckId);
    expect((await pool.query(`SELECT count(*)::int n FROM presentation_deck_versions WHERE deck_id=$1 AND version=1`,[deckId])).rows[0].n).toBe(1);
  });

  it('fails closed when a DOC stable id was preseeded without the approved source identity',async()=>{
    const claim=await proposal('document',{title:'Collision document',description:'approved'});
    const id=stableId('artifact-chat',claim.ingressId);
    await materializeDocumentArtifact({organizationId:org,userId:owner,externalArtifactId:id,useLlm:false,
      intake:{title:'Preseed',description:'different source',documentType:'generic_document',language:'pl'}});
    await expect(materializeClaimedChatTarget({organizationId:org,ingressId:claim.ingressId,
      claimToken:claim.claimToken,actorUserId:owner})).rejects.toMatchObject({code:'TARGET_ID_COLLISION'});
  });

  it('fails artifact_origin closed on canonical JSON hash drift',async()=>{
    const summary={z:1,a:{two:2,one:1}};
    const artifact=await registerArtifactOrigin({organizationId:org,outputType:'report',artifactFamily:'document',
      originRuntime:'native_artifact',originRecordId:`drift-${run}`,createdBy:owner,ownerUserId:owner,titleSnapshot:'Drift',originSummary:summary});
    const claim=await proposal('artifact_origin',{artifactId:artifact!.artifactId,originRuntime:'native_artifact',
      originRecordId:`drift-${run}`,contentHash:hash({different:true})});
    await expect(materializeClaimedChatTarget({organizationId:org,ingressId:claim.ingressId,
      claimToken:claim.claimToken,actorUserId:owner})).rejects.toMatchObject({code:'SOURCE_HASH_DRIFT'});
    const foreignArtifact=await registerArtifactOrigin({organizationId:foreignOrg,outputType:'report',artifactFamily:'document',
      originRuntime:'native_artifact',originRecordId:`foreign-${run}`,createdBy:foreignUser,ownerUserId:foreignUser,titleSnapshot:'Foreign',originSummary:summary});
    const foreignClaim=await proposal('artifact_origin',{artifactId:foreignArtifact!.artifactId,originRuntime:'native_artifact',
      originRecordId:`foreign-${run}`,contentHash:hash(summary)});
    await expect(materializeClaimedChatTarget({organizationId:org,ingressId:foreignClaim.ingressId,
      claimToken:foreignClaim.claimToken,actorUserId:owner})).rejects.toMatchObject({code:'TARGET_NOT_FOUND'});
  });

  it('mounts all mappings behind active membership and rejects revoked/foreign JWT contexts without a target write',async()=>{
    token=ownerToken;
    const claim=await proposal('workbook',{title:'Auth wall workbook',schema:{title:'Auth wall workbook',sheets:[{name:'A',columns:[{key:'A',header:'A'}],rows:[]}]}});
    token=revokedToken;
    const revoked=await materialize(claim); expect(revoked.status).toBe(403);
    token=foreignToken;
    const foreign=await materialize(claim); expect(foreign.status).toBe(404);
    token=ownerToken;
    expect((await pool.query(`SELECT count(*)::int n FROM generated_workbooks WHERE id=$1`,[stableId('chatworkbook',claim.ingressId)])).rows[0].n).toBe(0);
  });
});
