import { createHash, randomUUID } from 'node:crypto';

import { withPgTransaction } from '../../database/PostgresDatabase.js';
import { withPgTransaction as withOwnerPgTransaction } from '../../utils/queryHelpers.js';
import { materializeDocumentArtifact } from '../documentStudio/documentStudioService.js';
import {
  createNativeDeck,
  createNativeDeckVersion,
  withPresentationOwnerClient,
} from '../presentationGeneratorService.js';
import { createCanonicalWorkbook } from '../workbook/workbookCreationService.js';
import { completeChatOwnerIngress, ChatTargetOwnerIngressError } from './chatTargetOwnerIngressService.js';
import { canonicalSourceHash } from '../artifactHandoff/handoffSpineService.js';

type MappingKind = 'document'|'presentation'|'workbook'|'artifact_origin';
const sha = (v: unknown) => createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
const stableId = (prefix:string, ingressId:string) => `${prefix}-${sha(ingressId).slice(0,32)}`;
const canonicalJson = (value: unknown): unknown => {
  if (typeof value === 'string') {
    try { return canonicalJson(JSON.parse(value)); } catch { return value; }
  }
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).sort(([a],[b]) => a.localeCompare(b))
      .map(([key,item]) => [key, canonicalJson(item)])
  );
  return value;
};
const canonicalJsonHash = (value: unknown) => sha(canonicalJson(value));

export class ChatTargetMappingError extends Error {
  constructor(message:string, public code:string, public httpStatus=409){super(message);}
}

interface Envelope { schemaVersion?:string; requestedTargetKind?:string; commandSchemaVersion?:string;
  targetCommand?:Record<string,unknown>; conversationId?:string; messageId?:string; content?:string }
interface MappingRow { ingress_id:string; organization_id:string; proposal_id:string; target_kind:string;
  delivered_at:Date|string;
  source_version:number; source_content_hash:string; payload_json:Envelope|string; claim_token:string;
  claimed_by:string; lease_expires_at:Date|string; consumed_at:Date|string|null }

function commandEnvelope(row:MappingRow): { kind:MappingKind; command:Record<string,unknown>; digest:string } {
  const payload = typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) as Envelope : row.payload_json;
  if (payload.schemaVersion !== 'v1' || payload.commandSchemaVersion !== 'v1')
    throw new ChatTargetMappingError('unsupported target command schema','UNSUPPORTED_COMMAND_SCHEMA');
  const kind = payload.requestedTargetKind;
  if (!['document','presentation','workbook','artifact_origin'].includes(String(kind)))
    throw new ChatTargetMappingError('unsupported or ambiguous target mapping','UNSUPPORTED_TARGET_MAPPING');
  if (row.target_kind === 'material' && kind !== 'artifact_origin')
    throw new ChatTargetMappingError('material alias requires explicit artifact_origin mapping','AMBIGUOUS_MATERIAL_ALIAS');
  if (row.target_kind !== 'material' && row.target_kind !== kind)
    throw new ChatTargetMappingError('proposal target mapping drift','TARGET_MAPPING_DRIFT');
  if (!payload.targetCommand || typeof payload.targetCommand !== 'object')
    throw new ChatTargetMappingError('targetCommand is required','TARGET_COMMAND_REQUIRED',400);
  return {kind:kind as MappingKind, command:payload.targetCommand,
    digest:sha({kind,version:'v1',command:payload.targetCommand,sourceVersion:row.source_version,sourceHash:row.source_content_hash})};
}

async function executeOwner(
  row:MappingRow,
  kind:MappingKind,
  command:Record<string,unknown>,
  options: { crashAfterPresentationDeck?: boolean } = {}
) {
  const title=String(command.title||'').trim();
  if(kind!=='artifact_origin'&&!title) throw new ChatTargetMappingError('target title required','TARGET_COMMAND_INVALID',400);
  if(kind==='document'){
    const id=stableId('artifact-chat',row.ingress_id);
    const existing=await withPgTransaction(q=>q<{organization_id:string;content_json_native:unknown;provenance_json:unknown}>(
      `SELECT organization_id,content_json_native,provenance_json FROM wave5_artifacts WHERE artifact_id=$1`,[id]));
    if(existing.rows[0]) {
      if(existing.rows[0].organization_id!==row.organization_id) throw new ChatTargetMappingError('document stable id belongs to another tenant','TARGET_ID_COLLISION');
      const provenance=canonicalJson(existing.rows[0].provenance_json) as {metadata?:Record<string,unknown>};
      const metadata=provenance?.metadata??{};
      if(metadata?.chatOwnerSourceIdentity!==row.ingress_id || metadata?.chatOwnerSourceHash!==row.source_content_hash)
        throw new ChatTargetMappingError('document stable id provenance collision','TARGET_ID_COLLISION');
      return {id,version:'1',output:{schema:canonicalJson(existing.rows[0].content_json_native)}};
    }
    const result=await materializeDocumentArtifact({organizationId:row.organization_id,userId:row.claimed_by,
      externalArtifactId:id,ownerSourceIdentity:row.ingress_id,ownerSourceHash:row.source_content_hash,
      useLlm:false,intake:{title,description:String(command.description||''),
      documentType:'generic_document',language:command.language==='en'?'en':'pl'}});
    return {id:result.artifactId,version:'1',output:{schema:result.schema}};
  }
  if(kind==='presentation'){
    const deckId=stableId('chatdeck',row.ingress_id).replace(/-/g,'').slice(0,40);
    const slides=Array.isArray(command.slides)?command.slides:[];
    if(!slides.length) throw new ChatTargetMappingError('presentation slides required','TARGET_COMMAND_INVALID',400);
    const unifiedJson={meta:{client:'',project:title,date:new Date(row.delivered_at).toISOString(),author:row.claimed_by,
      confidentiality:'internal',language:'pl',sourceType:'chat_handoff'},
      slides:slides.map((s:any,i:number)=>({intent:'key_messages',key_message:String(s.title||`Slide ${i+1}`),
        content:{type:'key_messages',messages:(Array.isArray(s.bullets)?s.bullets:[s.content||'']).map((x:any,j:number)=>
          ({title:`Point ${j+1}`,description:String(x)}))}}))} as any;
    return withOwnerPgTransaction(async tx => withPresentationOwnerClient(tx, async () => {
      const found=await tx.query<{organization_id:string;deck_json:unknown;unified_json:unknown;version:number;source_type:string;source_id:string}>(
        `SELECT organization_id,deck_json,unified_json,version,source_type,source_id FROM presentation_decks WHERE id=?`,[deckId]);
      const existing=found.rows[0];
      if(existing){
        if(existing.organization_id!==row.organization_id || existing.source_type!=='chat_handoff' || existing.source_id!==row.ingress_id ||
          canonicalJsonHash(existing.unified_json)!==canonicalJsonHash(unifiedJson))
          throw new ChatTargetMappingError('presentation stable id/source collision','TARGET_ID_COLLISION');
        const versions=await tx.query<{deck_json_snapshot:unknown}>(
          `SELECT deck_json_snapshot FROM presentation_deck_versions WHERE deck_id=? AND version=1`,[deckId]);
        if(versions.rows[0] && canonicalJsonHash(versions.rows[0].deck_json_snapshot)!==canonicalJsonHash(existing.deck_json))
          throw new ChatTargetMappingError('presentation version digest collision','TARGET_VERSION_COLLISION');
        if(!versions.rows[0]) await createNativeDeckVersion({deckId,organizationId:row.organization_id,version:1,
          deck:existing.deck_json as any,slideCount:unifiedJson.slides.length,createdBy:row.claimed_by,createdAt:new Date().toISOString()});
        return {id:deckId,version:String(existing.version),output:{deck:canonicalJson(existing.deck_json),unifiedJson:canonicalJson(existing.unified_json)}};
      }
      const createdAt=new Date().toISOString();
      const result=await createNativeDeck({deckId,organizationId:row.organization_id,title,unifiedJson,
        sourceType:'chat_handoff',sourceId:row.ingress_id,createdBy:row.claimed_by,createdAt,registerArtifact:false});
      if(options.crashAfterPresentationDeck) throw new ChatTargetMappingError('injected crash between deck and version','INJECTED_PRESENTATION_CRASH',500);
      await createNativeDeckVersion({deckId:result.deckId,organizationId:row.organization_id,version:1,
        deck:result.deck,slideCount:result.slideCount,createdBy:row.claimed_by,createdAt});
      return {id:result.deckId,version:'1',output:{deck:result.deck,unifiedJson}};
    }));
  }
  if(kind==='workbook'){
    const schema=(command.schema||{}) as any;
    if(!Array.isArray(schema.sheets)||!schema.sheets.length) throw new ChatTargetMappingError('workbook sheets required','TARGET_COMMAND_INVALID',400);
    const result=await createCanonicalWorkbook({workbookId:stableId('chatworkbook',row.ingress_id),organizationId:row.organization_id,
      userId:row.claimed_by,title,schema,sourceIdentity:row.ingress_id,sourceHash:row.source_content_hash});
    return {id:result.workbookId,version:String(result.version),output:{schema:result.schema,bytesHash:result.bytesHash}};
  }
  const artifactId=String(command.artifactId||''); const originRuntime=String(command.originRuntime||'');
  const originRecordId=String(command.originRecordId||''); const expectedHash=String(command.contentHash||'');
  if(!artifactId||!originRuntime||!originRecordId||!expectedHash) throw new ChatTargetMappingError('artifact origin identity/hash required','TARGET_COMMAND_INVALID',400);
  const found=await withPgTransaction(q=>q<{artifact_id:string;origin_summary_json:unknown}>(
    `SELECT a.artifact_id,a.origin_summary_json FROM v8_output_artifacts a JOIN v8_artifact_origin_links l
      ON l.artifact_id=a.artifact_id AND l.organization_id=a.organization_id
     WHERE a.organization_id=$1 AND a.artifact_id=$2 AND l.origin_runtime=$3 AND l.origin_record_id=$4`,
    [row.organization_id,artifactId,originRuntime,originRecordId]));
  if(!found.rows[0]) throw new ChatTargetMappingError('canonical artifact origin not found','TARGET_NOT_FOUND',404);
  const actual=canonicalJsonHash(found.rows[0].origin_summary_json??{});
  if(actual!==expectedHash) throw new ChatTargetMappingError('artifact origin hash drift','SOURCE_HASH_DRIFT');
  return {id:artifactId,version:'origin-v1',output:{artifactId,originRuntime,originRecordId,contentHash:actual}};
}

export async function materializeClaimedChatTarget(input:{organizationId:string;ingressId:string;claimToken:string;
  actorUserId:string; crashAfterTarget?:boolean; crashAfterOwnerIngress?:boolean;
  crashAfterPresentationDeck?:boolean}) {
  const prepared=await withPgTransaction(async q=>{
    const selected=await q<MappingRow>(`SELECT i.*,c.claim_token,c.claimed_by,c.lease_expires_at,c.consumed_at
      FROM chat_handoff_owner_ingress i JOIN chat_handoff_owner_claims c ON c.ingress_id=i.ingress_id
      WHERE i.organization_id=$1 AND i.ingress_id=$2 FOR UPDATE OF c`,[input.organizationId,input.ingressId]);
    const row=selected.rows[0]; if(!row) throw new ChatTargetMappingError('ingress not found','NOT_FOUND',404);
    if(row.claim_token!==input.claimToken||row.claimed_by!==input.actorUserId) throw new ChatTargetMappingError('claim mismatch','CLAIM_MISMATCH');
    if(new Date(row.lease_expires_at).getTime()<=Date.now()) throw new ChatTargetMappingError('claim expired','CLAIM_EXPIRED');
    const envelope=commandEnvelope(row);
    await q(`INSERT INTO chat_target_mapping_receipts(ingress_id,organization_id,target_kind,command_schema_version,request_digest)
      VALUES($1,$2,$3,'v1',$4) ON CONFLICT(ingress_id) DO NOTHING`,[row.ingress_id,row.organization_id,envelope.kind,envelope.digest]);
    const receipt=await q<any>(`SELECT * FROM chat_target_mapping_receipts WHERE ingress_id=$1 FOR UPDATE`,[row.ingress_id]);
    const current=receipt.rows[0];
    if(current.request_digest!==envelope.digest) throw new ChatTargetMappingError('idempotency payload collision','IDEMPOTENCY_COLLISION');
    if(current.state==='succeeded') return {row,envelope,replay:current,reconcileConsumed:false};
    if(row.consumed_at) return {row,envelope,replay:null,reconcileConsumed:true};
    if(current.state==='running'&&current.lease_token===input.claimToken) throw new ChatTargetMappingError('mapping already running','MAPPING_IN_PROGRESS');
    const reclaimed=current.state==='running';
    await q(`UPDATE chat_target_mapping_receipts SET state='running',lease_token=$2,lease_owner=$3,
      lease_expires_at=$4,attempt_count=attempt_count+1,error_code=NULL,updated_at=NOW() WHERE ingress_id=$1`,
      [row.ingress_id,input.claimToken,input.actorUserId,row.lease_expires_at]);
    await q(`INSERT INTO chat_target_mapping_attempts(attempt_id,ingress_id,organization_id,lease_token,actor_user_id,event_type)
      VALUES($1,$2,$3,$4,$5,$6)`,[randomUUID(),row.ingress_id,row.organization_id,input.claimToken,input.actorUserId,reclaimed?'reclaimed':'claimed']);
    return {row,envelope,replay:null,reconcileConsumed:false};
  });
  if(prepared.replay) return {targetRecordId:prepared.replay.target_record_id,outputDigest:prepared.replay.output_digest,replayed:true};
  try{
    const target=await executeOwner(prepared.row,prepared.envelope.kind,prepared.envelope.command,
      {crashAfterPresentationDeck:input.crashAfterPresentationDeck});
    if(input.crashAfterTarget) throw new ChatTargetMappingError('injected crash after target','INJECTED_CRASH',500);
    const outputDigest=sha({kind:prepared.envelope.kind,id:target.id,version:target.version,output:target.output});
    const handoff=await completeChatOwnerIngress({organizationId:input.organizationId,ingressId:input.ingressId,
      claimToken:input.claimToken,targetRecordId:target.id,materializedBy:input.actorUserId,outputPayload:{...target.output,outputDigest,commandVersion:'v1'}});
    if(input.crashAfterOwnerIngress) throw new ChatTargetMappingError('injected crash after owner ingress','INJECTED_OWNER_INGRESS_CRASH',500);
    if(prepared.reconcileConsumed) {
      const shared=await withPgTransaction(q=>q<{target_record_id:string;output_content_hash:string|null}>(
        `SELECT r.target_record_id,r.output_content_hash FROM chat_handoff_owner_claims c
          JOIN artifact_handoff_receipts r ON r.receipt_id=c.handoff_receipt_id
         WHERE c.ingress_id=$1 AND c.organization_id=$2`,[input.ingressId,input.organizationId]));
      const expectedSharedHash=canonicalSourceHash({...target.output,outputDigest,commandVersion:'v1'});
      if(!shared.rows[0] || shared.rows[0].target_record_id!==target.id || shared.rows[0].output_content_hash!==expectedSharedHash)
        throw new ChatTargetMappingError('consumed owner receipt does not match canonical target','OWNER_RECEIPT_DRIFT');
    }
    await withPgTransaction(async q=>{await q(`UPDATE chat_target_mapping_receipts SET state='succeeded',target_record_id=$2,target_version=$3,
      output_digest=$4,lease_token=NULL,lease_owner=NULL,lease_expires_at=NULL,updated_at=NOW() WHERE ingress_id=$1 AND lease_token=$5`,
      [input.ingressId,target.id,target.version,outputDigest,input.claimToken]); await q(`INSERT INTO chat_target_mapping_attempts
      (attempt_id,ingress_id,organization_id,lease_token,actor_user_id,event_type,detail_json) VALUES($1,$2,$3,$4,$5,'succeeded',$6::jsonb)`,
      [randomUUID(),input.ingressId,input.organizationId,input.claimToken,input.actorUserId,JSON.stringify({targetRecordId:target.id,outputDigest})]);});
    return {targetRecordId:target.id,outputDigest,replayed:handoff.replayed};
  }catch(err){
    if(!(err instanceof ChatTargetMappingError&&err.code==='INJECTED_CRASH')) await withPgTransaction(async q=>{
      await q(`UPDATE chat_target_mapping_receipts SET state='failed',error_code=$2,updated_at=NOW() WHERE ingress_id=$1 AND lease_token=$3`,
      [input.ingressId,err instanceof Error?err.message:'TARGET_FAILED',input.claimToken]);});
    if(err instanceof ChatTargetOwnerIngressError) throw new ChatTargetMappingError(err.message,err.code,err.httpStatus);
    throw err;
  }
}
