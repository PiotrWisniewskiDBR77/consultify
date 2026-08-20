import crypto, { randomUUID } from 'node:crypto';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import { hasFinanceEditRole } from '../../legacyCutover/requireActiveMembership.js';
import { getAssumptionsPatchForDepth, type ValuationDepth } from '../../valuationDepthProfileService.js';

type PinnedIdentity = {
  artifact_id: string;
  business_version_id: string;
  working_revision_id: string;
  working_revision_version: number;
  currency: string;
  status: string;
  legacy_status: string;
  archived_at: string | null;
};

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
}
const hash = (value: unknown) => crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
export async function assertFinanceEditor(tx:any,organizationId:string,userId:string){
  const member=await tx.queryOne(`SELECT status,role FROM organization_members WHERE organization_id=? AND user_id=? FOR SHARE`,[organizationId,userId]);
  if(String(member?.status||'').toUpperCase()!=='ACTIVE') throw Object.assign(new Error('Active membership required'),{code:'ORG_MEMBERSHIP_REVOKED'});
  if(!hasFinanceEditRole(member?.role)) throw Object.assign(new Error('Finance edit capability required'),{code:'FINANCE_EDIT_FORBIDDEN'});
}

async function pinnedIdentity(tx: any, organizationId: string, legacyId: string) {
  return tx.queryOne(
    `SELECT aa.artifact_id,aa.business_version_id,
            wr.working_revision_id,wr.version AS working_revision_version,
            v.currency,bv.status,v.status AS legacy_status,a.archived_at
       FROM finance_artifact_aliases aa
       JOIN finance_artifacts a ON a.artifact_id=aa.artifact_id AND a.organization_id=aa.organization_id
       JOIN finance_business_versions bv ON bv.business_version_id=aa.business_version_id
         AND bv.artifact_id=aa.artifact_id AND bv.organization_id=aa.organization_id
       JOIN finance_working_revisions wr ON wr.working_revision_id=bv.source_working_revision_id
         AND wr.organization_id=aa.organization_id AND wr.is_current=true
       JOIN valuations v ON v.id=aa.legacy_id AND v.organization_id=aa.organization_id
      WHERE aa.organization_id=? AND aa.legacy_table='valuations' AND aa.legacy_id=?
        AND a.artifact_type='VALUATION_CASE' AND a.current_business_version_id=aa.business_version_id
      ORDER BY aa.created_at DESC LIMIT 1 FOR UPDATE`,
    [organizationId, legacyId]
  );
}

function exactNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw Object.assign(new Error(`${name} must be finite`), { code: 'NEEDS_DECISION' });
  return value;
}

function assertIdentity(identity: PinnedIdentity, expected: any) {
  if (identity.status !== 'DRAFT' || identity.legacy_status === 'ARCHIVED' || identity.archived_at !== null) throw Object.assign(new Error('Canonical valuation is not editable'), { code: 'STATUS_IMMUTABLE' });
  if (
    identity.artifact_id !== expected.artifactId ||
    identity.business_version_id !== expected.businessVersionId ||
    identity.working_revision_id !== expected.workingRevisionId ||
    Number(identity.working_revision_version) !== Number(expected.workingRevisionVersion)
  ) throw Object.assign(new Error('Canonical valuation identity changed'), { code: 'CANONICAL_IDENTITY_CAS_CONFLICT' });
}

async function replayOrConflict(tx: any, organizationId: string, key: string, requestSha: string) {
  const row = await tx.queryOne(
    `SELECT * FROM finance_valuation_input_command_events WHERE organization_id=? AND idempotency_key=?`,
    [organizationId, key]
  );
  if (!row) return null;
  if (row.request_sha256 !== requestSha) throw Object.assign(new Error('Idempotency key reused'), { code: 'IDEMPOTENCY_KEY_REUSED' });
  return row;
}

export async function getPinnedLegacyValuationIdentity(organizationId: string, legacyId: string) {
  return withPinnedPostgresTransaction((tx) => pinnedIdentity(tx, organizationId, legacyId));
}

export async function readCanonicalLegacyValuationInputs(organizationId:string,legacyId:string){
  return withPinnedPostgresTransaction(async(tx)=>{
    const identity=await pinnedIdentity(tx,organizationId,legacyId);
    if(!identity) throw Object.assign(new Error('Legacy valuation is not mapped'),{code:'LEGACY_IDENTITY_UNMAPPED'});
    if(identity.legacy_status==='ARCHIVED'||identity.archived_at!==null) throw Object.assign(new Error('Canonical valuation is archived'),{code:'STATUS_IMMUTABLE'});
    const assumptions=await tx.queryOne<any>(`SELECT direct_wacc_pct,terminal_method,terminal_growth_pct,exit_multiple,exit_multiple_metric,net_debt_decimal,cash_tax_rate_pct,valuation_as_of_date::text,source_working_revision_id,source_working_revision_version,command_request_sha256 FROM finance_valuation_direct_assumptions WHERE organization_id=? AND business_version_id=?`,[organizationId,identity.business_version_id]);
    const method=await tx.queryOne<any>(`SELECT id,comps_metric_type,comps_min_multiple,comps_median_multiple,comps_max_multiple,source_working_revision_id,source_working_revision_version,command_request_sha256 FROM finance_valuation_methods WHERE organization_id=? AND business_version_id=? AND method_type='TRADING_COMPS'`,[organizationId,identity.business_version_id]);
    const peers=method?await tx.queryAll<any>(`SELECT peer_name FROM finance_valuation_comps WHERE organization_id=? AND method_id=? ORDER BY peer_name`,[organizationId,method.id]):[];
    return {identity,assumptions:assumptions?{waccPercent:Number(assumptions.direct_wacc_pct),terminalMethod:assumptions.terminal_method,terminalGrowthPercent:assumptions.terminal_growth_pct===null?null:Number(assumptions.terminal_growth_pct),exitMultiple:assumptions.exit_multiple===null?null:Number(assumptions.exit_multiple),exitMultipleMetric:assumptions.exit_multiple_metric,netDebt:Number(assumptions.net_debt_decimal),cashTaxRatePct:Number(assumptions.cash_tax_rate_pct),valuationAsOfDate:assumptions.valuation_as_of_date,manualForecast:{years:[]},sourceWorkingRevisionId:assumptions.source_working_revision_id,sourceWorkingRevisionVersion:Number(assumptions.source_working_revision_version),requestSha256:assumptions.command_request_sha256}:null,peers:method?{metric:method.comps_metric_type,min:Number(method.comps_min_multiple),median:Number(method.comps_median_multiple),max:Number(method.comps_max_multiple),peerSet:peers.map((p:any)=>p.peer_name),sourceWorkingRevisionId:method.source_working_revision_id,sourceWorkingRevisionVersion:Number(method.source_working_revision_version),requestSha256:method.command_request_sha256}:null};
  });
}

export async function loadCanonicalDirectValuationAssumptions(organizationId:string,businessVersionId:string){
  return withPinnedPostgresTransaction(tx=>tx.queryOne<any>(`SELECT * FROM finance_valuation_direct_assumptions WHERE organization_id=? AND business_version_id=?`,[organizationId,businessVersionId]));
}

export async function writeCanonicalLegacyWacc(params: any) {
  return withPinnedPostgresTransaction(async (tx) => {
    await assertFinanceEditor(tx,params.organizationId,params.userId);
    await tx.queryOne(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [`${params.organizationId}:${params.expected?.businessVersionId}:VALUATION_INPUTS`]);
    const identity = await pinnedIdentity(tx, params.organizationId, params.legacyId);
    if (!identity) throw Object.assign(new Error('Legacy valuation is not mapped'), { code: 'LEGACY_IDENTITY_UNMAPPED' });
    assertIdentity(identity, params.expected);
    const body = params.payload || {};
    const manualYears = body.manualForecast?.years;
    if (manualYears !== undefined && (!Array.isArray(manualYears) || manualYears.length > 0)) {
      throw Object.assign(new Error('Manual forecast requires canonical period lineage before cutover'), { code: 'NEEDS_DECISION' });
    }
    const terminalMethod = body.terminalMethod;
    if (terminalMethod !== 'gordon' && terminalMethod !== 'exit_multiple') {
      throw Object.assign(new Error('Unsupported terminal method'), { code: 'NEEDS_DECISION' });
    }
    const typed = {
      directWaccPct: exactNumber(body.waccPercent, 'waccPercent'),
      terminalMethod,
      terminalGrowthPct: terminalMethod === 'gordon' ? exactNumber(body.terminalGrowthPercent, 'terminalGrowthPercent') : null,
      exitMultiple: terminalMethod === 'exit_multiple' ? exactNumber(body.exitMultiple, 'exitMultiple') : null,
      exitMultipleMetric: terminalMethod === 'exit_multiple' && body.exitMultipleMetric === 'EV/EBITDA' ? body.exitMultipleMetric : null,
      netDebtDecimal: exactNumber(body.netDebt, 'netDebt'),
      cashTaxRatePct: exactNumber(body.cashTaxRatePct,'cashTaxRatePct'),
      valuationAsOfDate: typeof body.valuationAsOfDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(body.valuationAsOfDate)?body.valuationAsOfDate:null,
    };
    if(typed.directWaccPct<=0||typed.cashTaxRatePct<0||typed.cashTaxRatePct>100||!typed.valuationAsOfDate||(typed.terminalMethod==='gordon'&&typed.terminalGrowthPct!>=typed.directWaccPct)||(typed.terminalMethod==='exit_multiple'&&typed.exitMultiple!<=0)) throw Object.assign(new Error('Invalid WACC/terminal/tax/date domain values'),{code:'NEEDS_DECISION'});
    if(terminalMethod==='exit_multiple'&&!typed.exitMultipleMetric) throw Object.assign(new Error('Only typed EV/EBITDA exit-multiple lineage is supported'),{code:'NEEDS_DECISION'});
    const requestSha = hash({ identity, typed });
    const replay = await replayOrConflict(tx, params.organizationId, params.idempotencyKey, requestSha);
    if (!replay) {
      await tx.queryRun(
        `INSERT INTO finance_valuation_direct_assumptions
          (organization_id,artifact_id,business_version_id,source_working_revision_id,
           source_working_revision_version,direct_wacc_pct,currency,terminal_method,
           terminal_growth_pct,exit_multiple,exit_multiple_metric,net_debt_decimal,cash_tax_rate_pct,valuation_as_of_date,
           command_idempotency_key,command_request_sha256,updated_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT (organization_id,business_version_id) DO UPDATE SET
           artifact_id=EXCLUDED.artifact_id,source_working_revision_id=EXCLUDED.source_working_revision_id,
           source_working_revision_version=EXCLUDED.source_working_revision_version,
           direct_wacc_pct=EXCLUDED.direct_wacc_pct,currency=EXCLUDED.currency,
           terminal_method=EXCLUDED.terminal_method,terminal_growth_pct=EXCLUDED.terminal_growth_pct,
           exit_multiple=EXCLUDED.exit_multiple,exit_multiple_metric=EXCLUDED.exit_multiple_metric,
           net_debt_decimal=EXCLUDED.net_debt_decimal,cash_tax_rate_pct=EXCLUDED.cash_tax_rate_pct,valuation_as_of_date=EXCLUDED.valuation_as_of_date,command_idempotency_key=EXCLUDED.command_idempotency_key,
           command_request_sha256=EXCLUDED.command_request_sha256,updated_by=EXCLUDED.updated_by,updated_at=now()`,
        [params.organizationId,identity.artifact_id,identity.business_version_id,identity.working_revision_id,identity.working_revision_version,typed.directWaccPct,identity.currency,typed.terminalMethod,typed.terminalGrowthPct,typed.exitMultiple,typed.exitMultipleMetric,typed.netDebtDecimal,typed.cashTaxRatePct,typed.valuationAsOfDate,params.idempotencyKey,requestSha,params.userId]
      );
      await tx.queryRun(
        `INSERT INTO finance_valuation_input_command_events
          (event_id,organization_id,idempotency_key,input_kind,request_sha256,artifact_id,business_version_id,working_revision_id,working_revision_version,created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [randomUUID(),params.organizationId,params.idempotencyKey,'WACC_ASSUMPTIONS',requestSha,identity.artifact_id,identity.business_version_id,identity.working_revision_id,identity.working_revision_version,params.userId]
      );
    }
    const readback = await tx.queryOne<any>(`SELECT direct_wacc_pct,terminal_method,terminal_growth_pct,exit_multiple,exit_multiple_metric,net_debt_decimal,cash_tax_rate_pct,valuation_as_of_date::text,source_working_revision_id,source_working_revision_version,command_request_sha256 FROM finance_valuation_direct_assumptions WHERE organization_id=? AND business_version_id=?`, [params.organizationId,identity.business_version_id]);
    const exact = readback && readback.command_request_sha256===requestSha &&
      Number(readback.direct_wacc_pct)===typed.directWaccPct && readback.terminal_method===typed.terminalMethod &&
      (typed.terminalGrowthPct===null ? readback.terminal_growth_pct===null : Number(readback.terminal_growth_pct)===typed.terminalGrowthPct) &&
      (typed.exitMultiple===null ? readback.exit_multiple===null : Number(readback.exit_multiple)===typed.exitMultiple) &&
      readback.exit_multiple_metric===typed.exitMultipleMetric && Number(readback.net_debt_decimal)===typed.netDebtDecimal &&
      Number(readback.cash_tax_rate_pct)===typed.cashTaxRatePct && readback.valuation_as_of_date===typed.valuationAsOfDate &&
      readback.source_working_revision_id===identity.working_revision_id && Number(readback.source_working_revision_version)===Number(identity.working_revision_version);
    if(!exact) throw new Error('CANONICAL_COLD_READBACK_MISMATCH');
    return { identity, replay: Boolean(replay), requestSha256: requestSha, readback };
  });
}

export async function writeCanonicalLegacyPeers(params: any) {
  return withPinnedPostgresTransaction(async (tx) => {
    await assertFinanceEditor(tx,params.organizationId,params.userId);
    await tx.queryOne(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [`${params.organizationId}:${params.expected?.businessVersionId}:VALUATION_INPUTS`]);
    const identity = await pinnedIdentity(tx, params.organizationId, params.legacyId);
    if (!identity) throw Object.assign(new Error('Legacy valuation is not mapped'), { code: 'LEGACY_IDENTITY_UNMAPPED' });
    assertIdentity(identity, params.expected);
    const body = params.payload || {};
    if (body.metric !== 'EV/EBITDA' || !Array.isArray(body.peerSet) || body.peerSet.some((p: unknown) => typeof p !== 'string' || !p.trim())) throw Object.assign(new Error('Only the canonical EV/EBITDA metric and a typed peerSet are supported'), { code: 'NEEDS_DECISION' });
    const typed = { metric: body.metric, min: exactNumber(body.min,'min'), median: exactNumber(body.median,'median'), max: exactNumber(body.max,'max'), peerSet: [...new Set(body.peerSet.map((p: string) => p.trim()))].sort() };
    if (!(typed.min>0&&typed.min <= typed.median && typed.median <= typed.max)) throw Object.assign(new Error('Comparable range must be positive and ordered'), { code: 'NEEDS_DECISION' });
    const requestSha = hash({ identity, typed });
    const replay = await replayOrConflict(tx, params.organizationId, params.idempotencyKey, requestSha);
    let method = await tx.queryOne<any>(`SELECT * FROM finance_valuation_methods WHERE organization_id=? AND business_version_id=? AND method_type='TRADING_COMPS' FOR UPDATE`, [params.organizationId,identity.business_version_id]);
    if (!replay) {
      if (!method) method = await tx.queryOne<any>(`INSERT INTO finance_valuation_methods (id,organization_id,business_version_id,method_type,created_by) VALUES (?,?,?,?,?) RETURNING *`, [randomUUID(),params.organizationId,identity.business_version_id,'TRADING_COMPS',params.userId]);
      await tx.queryRun(`UPDATE finance_valuation_methods SET comps_metric_type=?,comps_min_multiple=?,comps_median_multiple=?,comps_max_multiple=?,source_working_revision_id=?,source_working_revision_version=?,command_idempotency_key=?,command_request_sha256=?,readiness=?,updated_at=now() WHERE id=? AND organization_id=?`, [typed.metric,typed.min,typed.median,typed.max,identity.working_revision_id,identity.working_revision_version,params.idempotencyKey,requestSha,typed.peerSet.length?'DATA_INCOMPLETE':'NOT_CONFIGURED',method.id,params.organizationId]);
      await tx.queryRun(`DELETE FROM finance_valuation_comps WHERE method_id=? AND organization_id=?`, [method.id,params.organizationId]);
      for (const peer of typed.peerSet) await tx.queryRun(`INSERT INTO finance_valuation_comps (id,organization_id,method_id,peer_name,metric_type,metric_value_status,created_by) VALUES (?,?,?,?,?,'MISSING',?)`, [randomUUID(),params.organizationId,method.id,peer,typed.metric,params.userId]);
      await tx.queryRun(`INSERT INTO finance_valuation_input_command_events (event_id,organization_id,idempotency_key,input_kind,request_sha256,artifact_id,business_version_id,working_revision_id,working_revision_version,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)`, [randomUUID(),params.organizationId,params.idempotencyKey,'TRADING_COMPS',requestSha,identity.artifact_id,identity.business_version_id,identity.working_revision_id,identity.working_revision_version,params.userId]);
    }
    if(!method) throw new Error('CANONICAL_METHOD_READBACK_MISSING');
    const readback = await tx.queryAll<any>(`SELECT peer_name,metric_type,metric_value_status FROM finance_valuation_comps WHERE organization_id=? AND method_id=? ORDER BY peer_name`, [params.organizationId,method.id]);
    const methodReadback=await tx.queryOne<any>(`SELECT comps_metric_type,comps_min_multiple,comps_median_multiple,comps_max_multiple,source_working_revision_id,source_working_revision_version,command_request_sha256 FROM finance_valuation_methods WHERE id=? AND organization_id=?`,[method.id,params.organizationId]);
    if(readback.length!==typed.peerSet.length||readback.some((row:any,index:number)=>row.peer_name!==typed.peerSet[index]||row.metric_type!==typed.metric)||!methodReadback||methodReadback.comps_metric_type!==typed.metric||Number(methodReadback.comps_min_multiple)!==typed.min||Number(methodReadback.comps_median_multiple)!==typed.median||Number(methodReadback.comps_max_multiple)!==typed.max||methodReadback.source_working_revision_id!==identity.working_revision_id||Number(methodReadback.source_working_revision_version)!==Number(identity.working_revision_version)||methodReadback.command_request_sha256!==requestSha) throw new Error('CANONICAL_COLD_READBACK_MISMATCH');
    return { identity, replay:Boolean(replay), requestSha256:requestSha, methodId:method.id, readback:{method:methodReadback,peers:readback} };
  });
}

export type CanonicalLegacyValuationDepthResult = {
  artifactId: string;
  businessVersionId: string;
  workingRevisionId: string;
  workingRevisionVersion: number;
  legacyValuationId: string;
  depth: ValuationDepth;
  requestSha256: string;
  replay: boolean;
};

/** ECO-W23 canonical owner write; valuations.assumptions is compatibility projection only. */
export async function writeCanonicalLegacyValuationDepth(params: {
  organizationId: string;
  userId: string;
  legacyId: string;
  depth: ValuationDepth;
  expected: { artifactId: string; businessVersionId: string; workingRevisionId: string; workingRevisionVersion: number };
  idempotencyKey: string;
  actor?: { userId?: string; userEmail?: string; ip?: string; userAgent?: string };
}): Promise<CanonicalLegacyValuationDepthResult> {
  const idempotencyKey=params.idempotencyKey.trim();
  if(!idempotencyKey) throw Object.assign(new Error('Idempotency-Key is required'),{code:'IDEMPOTENCY_KEY_REQUIRED'});
  if(params.depth!=='managerial'&&params.depth!=='banking') throw Object.assign(new Error('depth must be managerial or banking'),{code:'INVALID_DEPTH'});
  return withPinnedPostgresTransaction(async(tx)=>{
    await assertFinanceEditor(tx,params.organizationId,params.userId);
    await tx.queryOne(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`,[`${params.organizationId}:${params.legacyId}:VALUATION_DEPTH`]);
    const identity=await pinnedIdentity(tx,params.organizationId,params.legacyId);
    if(!identity) throw Object.assign(new Error('Legacy valuation is not mapped'),{code:'LEGACY_IDENTITY_UNMAPPED'});
    assertIdentity(identity,params.expected);
    const command={legacyValuationId:params.legacyId,artifactId:identity.artifact_id,businessVersionId:identity.business_version_id,workingRevisionId:identity.working_revision_id,workingRevisionVersion:Number(identity.working_revision_version),depth:params.depth};
    const requestSha256=hash(command);
    const prior=await tx.queryOne<any>(`SELECT request_sha256,response_json FROM finance_valuation_depth_command_receipts WHERE organization_id=? AND idempotency_key=?`,[params.organizationId,idempotencyKey]);
    if(prior&&prior.request_sha256!==requestSha256) throw Object.assign(new Error('Idempotency key reused'),{code:'IDEMPOTENCY_KEY_REUSED'});
    if(!prior){
      const compatibilityPatch=getAssumptionsPatchForDepth(params.depth);
      await tx.queryRun(`UPDATE valuations SET assumptions=COALESCE(assumptions,'{}'::jsonb)||?::jsonb,updated_at=now() WHERE organization_id=? AND id=?`,[JSON.stringify(compatibilityPatch),params.organizationId,params.legacyId]);
      await tx.queryRun(`INSERT INTO finance_valuation_depth_states (organization_id,legacy_valuation_id,artifact_id,business_version_id,source_working_revision_id,source_working_revision_version,valuation_depth,command_request_sha256,updated_by) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT (organization_id,business_version_id) DO UPDATE SET legacy_valuation_id=EXCLUDED.legacy_valuation_id,artifact_id=EXCLUDED.artifact_id,source_working_revision_id=EXCLUDED.source_working_revision_id,source_working_revision_version=EXCLUDED.source_working_revision_version,valuation_depth=EXCLUDED.valuation_depth,command_request_sha256=EXCLUDED.command_request_sha256,updated_by=EXCLUDED.updated_by,updated_at=now()`,[params.organizationId,params.legacyId,identity.artifact_id,identity.business_version_id,identity.working_revision_id,Number(identity.working_revision_version),params.depth,requestSha256,params.userId]);
      const response:Omit<CanonicalLegacyValuationDepthResult,'replay'>={...command,requestSha256};
      await tx.queryRun(`INSERT INTO finance_valuation_depth_command_receipts (organization_id,idempotency_key,request_sha256,legacy_valuation_id,artifact_id,business_version_id,working_revision_id,working_revision_version,valuation_depth,response_json,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,[params.organizationId,idempotencyKey,requestSha256,params.legacyId,identity.artifact_id,identity.business_version_id,identity.working_revision_id,Number(identity.working_revision_version),params.depth,JSON.stringify(response),params.userId]);
    }
    const state=await tx.queryOne<any>(`SELECT valuation_depth,command_request_sha256 FROM finance_valuation_depth_states WHERE organization_id=? AND business_version_id=?`,[params.organizationId,identity.business_version_id]);
    const legacy=await tx.queryOne<any>(`SELECT assumptions FROM valuations WHERE organization_id=? AND id=?`,[params.organizationId,params.legacyId]);
    const assumptions=legacy?.assumptions&&typeof legacy.assumptions==='string'?JSON.parse(legacy.assumptions):legacy?.assumptions||{};
    if(!state||state.valuation_depth!==params.depth||state.command_request_sha256!==requestSha256||assumptions.depth!==params.depth) throw Object.assign(new Error('Canonical depth projection drift'),{code:'CANONICAL_DEPTH_PROJECTION_DRIFT'});
    const response=prior?.response_json||{...command,requestSha256};
    return {...response,replay:Boolean(prior)} as CanonicalLegacyValuationDepthResult;
  });
}
