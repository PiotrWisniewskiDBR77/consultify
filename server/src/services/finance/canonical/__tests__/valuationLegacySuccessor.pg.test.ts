import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { exportsDir } from '../../../../utils/storagePaths.js';

const REAL = process.env.RUN_DB_TESTS==='1'&&process.env.MOCK_DB==='false'&&String(process.env.DATABASE_URL||'').startsWith('postgres');
if(REAL) process.env.DB_TYPE='postgres';

describe.skipIf(!REAL)('FIN-CANONICAL-SUCCESSORS-WAVE4 realPG',()=>{
  let txWrap:any,createArtifact:any,writeWacc:any,writePeers:any,writeDepth:any,loadDirect:any,readInputs:any,runLegacyCompute:any,generateNegotiationPack:any,exportPptx:any,discardValuation:any,listLegacyValuations:any,getLegacyValuation:any,findOrCreateMethod:any,computeGordon:any,discountFlows:any,computeEquity:any,writeTerminal:any,writeBridge:any;
  const orgId=`org-fin-wave4-${randomUUID()}`, userId=`user-fin-wave4-${randomUUID()}`, legacyId=randomUUID();
  let identity:any;
  beforeAll(async()=>{
    ({withPinnedPostgresTransaction:txWrap}=await import('../../../../database/PostgresDatabase.js'));
    ({createArtifact}=await import('../artifactVersionService.js'));
    ({writeCanonicalLegacyWacc:writeWacc,writeCanonicalLegacyPeers:writePeers,writeCanonicalLegacyValuationDepth:writeDepth}=await import('../valuationLegacySuccessorService.js'));
    ({loadCanonicalDirectValuationAssumptions:loadDirect,readCanonicalLegacyValuationInputs:readInputs}=await import('../valuationLegacySuccessorService.js'));
    ({runCanonicalLegacyValuationCompute:runLegacyCompute}=await import('../valuationLegacyComputeAdapterService.js'));
    ({generateCanonicalLegacyNegotiationPack:generateNegotiationPack}=await import('../valuationNegotiationPackService.js'));
    ({exportCanonicalLegacyValuationPptx:exportPptx}=await import('../valuationPptxExportService.js'));
    ({discardCanonicalLegacyValuation:discardValuation}=await import('../valuationDiscardService.js'));
    ({listValuations:listLegacyValuations,getValuation:getLegacyValuation}=await import('../../../valuationService.js'));
    ({findOrCreateMethod}=await import('../valuationComputeService.js'));
    ({computeGordonTerminalValue:computeGordon,writeTerminalRow:writeTerminal}=await import('../valuationTerminalService.js'));
    ({discountCashFlows:discountFlows}=await import('../valuationDiscountService.js'));
    ({computeEquityValue:computeEquity,writeBridge}=await import('../valuationBridgeService.js'));
    await txWrap((tx:any)=>tx.queryRun(`INSERT INTO organizations(id,name) VALUES (?,?)`,[orgId,'FIN Wave4']));
    await txWrap((tx:any)=>tx.queryRun(`INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,created_at) VALUES (?,?,?,'x','OWNER','active','Fin','Owner',now())`,[userId,orgId,`${userId}@test.local`]));
    await txWrap((tx:any)=>tx.queryRun(`INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at) VALUES (?,?,?,?, 'ACTIVE',now())`,[randomUUID(),orgId,userId,'OWNER']));
    const created=await createArtifact({organizationId:orgId,artifactType:'VALUATION_CASE',naturalKey:'wave4',createdBy:userId});
    identity={artifactId:created.artifact.artifact_id,businessVersionId:created.businessVersion.business_version_id,workingRevisionId:created.workingRevision.working_revision_id,workingRevisionVersion:created.workingRevision.version};
    await txWrap(async(tx:any)=>{
      await tx.queryRun(`UPDATE finance_artifacts SET current_business_version_id=? WHERE artifact_id=? AND organization_id=?`,[identity.businessVersionId,identity.artifactId,orgId]);
      await tx.queryRun(`INSERT INTO valuations(id,organization_id,title,source_type,currency,status,created_by) VALUES (?,?,?,'manual','PLN','DRAFT',?)`,[legacyId,orgId,'Legacy',userId]);
      await tx.queryRun(`INSERT INTO finance_artifact_aliases(legacy_table,legacy_id,artifact_id,organization_id,business_version_id,mapping_confidence) VALUES ('valuations',?,?,?,?, 'AUTO_MIGRATE')`,[legacyId,identity.artifactId,orgId,identity.businessVersionId]);
      const stmt=await createArtifact({organizationId:orgId,artifactType:'STATEMENT_PACK',naturalKey:'wave4-stmt',createdBy:userId});
      const baseline=await createArtifact({organizationId:orgId,artifactType:'BASELINE_MODEL',naturalKey:'wave4-base',createdBy:userId});
      const entityId=randomUUID(),calId=randomUUID();
      await tx.queryRun(`INSERT INTO finance_stmt_calendars(fiscal_calendar_id,organization_id,calendar_type,fiscal_year_end_month,effective_from,created_by) VALUES (?,?,'STANDARD',12,'2026-01-01',?)`,[calId,orgId,userId]);
      const periods=[['2026','2026-01-01','2026-12-31'],['2027','2027-01-01','2027-12-31'],['2028','2028-01-01','2028-12-31']].map(([year,start,end])=>({id:randomUUID(),year:Number(year),start,end}));
      for(const p of periods)await tx.queryRun(`INSERT INTO finance_stmt_periods(period_id,organization_id,fiscal_calendar_id,period_type,fiscal_year,period_start,period_end,label,created_by) VALUES (?,?,?,'FY',?,?,?,?,?)`,[p.id,orgId,calId,p.year,p.start,p.end,`FY${p.year}`,userId]);
      await tx.queryRun(`INSERT INTO finance_stmt_entities(id,organization_id,business_version_id,entity_code,legal_name,role,consolidation_method,ownership_pct,functional_currency,created_by) VALUES (?,?,?,'GROUP','Wave4 Co','GROUP_PARENT','FULL',100,'PLN',?)`,[entityId,orgId,stmt.businessVersion.business_version_id,userId]);
      const lines=await tx.queryAll(`SELECT id,line_code FROM financial_statement_lines WHERE line_code IN ('EBIT','DEPRECIATION','CAPEX','WORKING_CAPITAL')`);const byCode=new Map(lines.map((r:any)=>[r.line_code,r.id]));
      await tx.queryRun(`INSERT INTO finance_stmt_lines(id,organization_id,business_version_id,statement_type,canonical_line_id,entity_id,period_id,value_status,value_decimal,native_currency,presentation_currency,unit,accounting_policy,created_by) VALUES (?,?,?,'BS',?,?,?,'PRESENT_NONZERO',45,'PLN','PLN','UNITS','IFRS',?)`,[randomUUID(),orgId,stmt.businessVersion.business_version_id,byCode.get('WORKING_CAPITAL'),entityId,periods[0].id,userId]);
      for(const [p,values] of [[periods[1],{EBIT:100,DEPRECIATION:10,CAPEX:20,WORKING_CAPITAL:50}],[periods[2],{EBIT:110,DEPRECIATION:10,CAPEX:20,WORKING_CAPITAL:55}]] as any){for(const [code,value] of Object.entries(values)){await tx.queryRun(`INSERT INTO finance_baseline_outputs(id,organization_id,business_version_id,statement_type,canonical_line_id,entity_id,period_id,value_status,value_decimal,native_currency,presentation_currency,unit,multiplier,value_kind,created_by) VALUES (?,?,?, ?,?,?,?,'PRESENT_NONZERO',?,'PLN','PLN','UNITS',1,'FORECAST',?)`,[randomUUID(),orgId,baseline.businessVersion.business_version_id,code==='WORKING_CAPITAL'?'BS':code==='CAPEX'?'CF':'P&L',byCode.get(code),entityId,p.id,value,userId]);}}
      await tx.queryRun(`INSERT INTO finance_lineage_edges(id,organization_id,source_version_id,source_artifact_type,target_version_id,target_artifact_type,edge_type,transformation_kind,author_id) VALUES (?,?,?,'STATEMENT_PACK',?,'BASELINE_MODEL','STATEMENT_TO_MODEL','COMPUTE',?)`,[randomUUID(),orgId,stmt.businessVersion.business_version_id,baseline.businessVersion.business_version_id,userId]);
      await tx.queryRun(`INSERT INTO finance_lineage_edges(id,organization_id,source_version_id,source_artifact_type,target_version_id,target_artifact_type,edge_type,transformation_kind,assumption_snapshot_hash,author_id) VALUES (?,?,?,'BASELINE_MODEL',?,'VALUATION_CASE','MODEL_TO_VALUATION','COMPUTE',?,?)`,[randomUUID(),orgId,baseline.businessVersion.business_version_id,identity.businessVersionId,`snapshot-${randomUUID()}`,userId]);
    });
  },60000);

  it('same-key concurrent WACC retry is one typed command and never mutates legacy',async()=>{
    const idempotencyKey=`wacc-same-key-${randomUUID()}`;
    const params={organizationId:orgId,userId,legacyId,expected:identity,idempotencyKey,payload:{waccPercent:11,terminalMethod:'gordon',terminalGrowthPercent:2,exitMultiple:8,exitMultipleMetric:'EV/EBITDA',netDebt:100,cashTaxRatePct:19,valuationAsOfDate:'2028-12-31',manualForecast:{years:[]}}};
    const [a,b]=await Promise.all([writeWacc(params),writeWacc(params)]);
    expect([a.replay,b.replay].sort()).toEqual([false,true]);
    const rows=await txWrap((tx:any)=>tx.queryAll(`SELECT * FROM finance_valuation_input_command_events WHERE organization_id=? AND idempotency_key=?`,[orgId,idempotencyKey]));
    expect(rows).toHaveLength(1);
    const legacy=await txWrap((tx:any)=>tx.queryOne(`SELECT assumptions,peers FROM valuations WHERE id=?`,[legacyId]));
    expect(legacy.assumptions).toEqual({}); expect(legacy.peers).toEqual([]);
    await expect(writeWacc({...params,payload:{...params.payload,waccPercent:12}})).rejects.toMatchObject({code:'IDEMPOTENCY_KEY_REUSED'});
  });

  it('writes depth once, replays exactly, projects compatibly and denies replay after revocation',async()=>{
    const key=`depth-${randomUUID()}`;
    const params={organizationId:orgId,userId,legacyId,expected:identity,idempotencyKey:key,depth:'managerial' as const};
    const [a,b]=await Promise.all([writeDepth(params),writeDepth(params)]);
    expect([a.replay,b.replay].sort()).toEqual([false,true]);
    expect(a).toMatchObject({artifactId:identity.artifactId,businessVersionId:identity.businessVersionId,legacyValuationId:legacyId,depth:'managerial'});
    const cold=await txWrap(async(tx:any)=>({
      state:await tx.queryOne(`SELECT valuation_depth,command_request_sha256 FROM finance_valuation_depth_states WHERE organization_id=? AND business_version_id=?`,[orgId,identity.businessVersionId]),
      receipt:await tx.queryOne(`SELECT valuation_depth,request_sha256 FROM finance_valuation_depth_command_receipts WHERE organization_id=? AND idempotency_key=?`,[orgId,key]),
      legacy:await tx.queryOne(`SELECT assumptions FROM valuations WHERE organization_id=? AND id=?`,[orgId,legacyId]),
    }));
    expect(cold.state).toEqual({valuation_depth:'managerial',command_request_sha256:a.requestSha256});
    expect(cold.receipt).toEqual({valuation_depth:'managerial',request_sha256:a.requestSha256});
    expect(cold.legacy.assumptions.depth).toBe('managerial');
    await expect(writeDepth({...params,depth:'banking'})).rejects.toMatchObject({code:'IDEMPOTENCY_KEY_REUSED'});
    await expect(txWrap((tx:any)=>tx.queryRun(`DELETE FROM finance_valuation_depth_command_receipts WHERE organization_id=? AND idempotency_key=?`,[orgId,key]))).rejects.toThrow(/append-only/);
    await txWrap((tx:any)=>tx.queryRun(`UPDATE organization_members SET status='REVOKED' WHERE organization_id=? AND user_id=?`,[orgId,userId]));
    await expect(writeDepth(params)).rejects.toMatchObject({code:'ORG_MEMBERSHIP_REVOKED'});
    await txWrap((tx:any)=>tx.queryRun(`UPDATE organization_members SET status='ACTIVE' WHERE organization_id=? AND user_id=?`,[orgId,userId]));
    expect((await writeDepth(params)).replay).toBe(true);
  });

  it('service boundary denies viewer and revoked membership with zero mutation',async()=>{
    for(const [role,status] of [['MEMBER','ACTIVE'],['CONSULTANT','ACTIVE'],['GUEST','ACTIVE'],['MEMBER','REVOKED']] as const){
      const denied=`denied-${role}-${randomUUID()}`;
      await txWrap((tx:any)=>tx.queryRun(`INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,created_at) VALUES (?,?,?,'x','USER','active','Fin','Denied',now())`,[denied,orgId,`${denied}@test.local`]));
      await txWrap((tx:any)=>tx.queryRun(`INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at) VALUES (?,?,?,?,?,now())`,[randomUUID(),orgId,denied,role,status]));
      await expect(writePeers({organizationId:orgId,userId:denied,legacyId,expected:identity,idempotencyKey:`deny-${denied}`,payload:{metric:'EV/EBITDA',min:6,median:8,max:10,peerSet:['X']}})).rejects.toMatchObject({code:status==='ACTIVE'?'FINANCE_EDIT_FORBIDDEN':'ORG_MEMBERSHIP_REVOKED'});
      await expect(runLegacyCompute({organizationId:orgId,userId:denied,legacyId,idempotencyKey:`deny-compute-${denied}`})).rejects.toMatchObject({code:status==='ACTIVE'?'FINANCE_EDIT_FORBIDDEN':'ORG_MEMBERSHIP_REVOKED'});
      const event=await txWrap((tx:any)=>tx.queryOne(`SELECT event_id FROM finance_valuation_input_command_events WHERE organization_id=? AND idempotency_key=?`,[orgId,`deny-${denied}`])); expect(event).toBeNull();
      const receipt=await txWrap((tx:any)=>tx.queryOne(`SELECT job_id FROM finance_valuation_compute_command_receipts WHERE organization_id=? AND idempotency_key=?`,[orgId,`deny-compute-${denied}`]));expect(receipt).toBeNull();
    }
  });

  it('route policy denies viewer/revoked and accepts owner/admin/finance editor',async()=>{
    const users:any={owner:userId};
    for(const [name,role,status] of [['admin','ADMIN','ACTIVE'],['member','MEMBER','ACTIVE'],['consultant','CONSULTANT','ACTIVE'],['viewer','GUEST','ACTIVE'],['revoked','MEMBER','REVOKED']] as const){
      users[name]=`${name}-${randomUUID()}`;
      await txWrap((tx:any)=>tx.queryRun(`INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,created_at) VALUES (?,?,?,'x','USER','active','Fin','Matrix',now())`,[users[name],orgId,`${users[name]}@test.local`]));
      await txWrap((tx:any)=>tx.queryRun(`INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at) VALUES (?,?,?,?,?,now())`,[randomUUID(),orgId,users[name],role,status]));
    }
    const {requireFinanceEditorMembership,hasFinanceEditRole}=await import('../../../../services/legacyCutover/requireActiveMembership.js');
    const app=express(); app.use((req:any,_res,next)=>{req.v8Context={organizationId:orgId,userId:String(req.headers['x-test-user'])};next();}); app.put('/edit',requireFinanceEditorMembership,(_req,res)=>res.status(204).end());
    for(const name of ['owner','admin']) expect((await request(app).put('/edit').set('x-test-user',users[name])).status).toBe(204);
    expect(hasFinanceEditRole('finance_editor')).toBe(true);
    expect((await request(app).put('/edit').set('x-test-user',users.viewer)).status).toBe(403);
    expect((await request(app).put('/edit').set('x-test-user',users.member)).status).toBe(403);
    expect((await request(app).put('/edit').set('x-test-user',users.consultant)).status).toBe(403);
    expect((await request(app).put('/edit').set('x-test-user',users.revoked)).status).toBe(403);
  });

  it('writes typed TRADING_COMPS rows, replays exactly, and rejects stale CAS',async()=>{
    const params={organizationId:orgId,userId,legacyId,expected:identity,idempotencyKey:`peers-same-key-${randomUUID()}`,payload:{metric:'EV/EBITDA',min:6,median:8,max:10,peerSet:['B','A']}};
    const first=await writePeers(params); const replay=await writePeers(params);
    expect(first.readback.peers.map((r:any)=>r.peer_name)).toEqual(['A','B']); expect(replay.replay).toBe(true);
    const cold=await readInputs(orgId,legacyId); expect(cold.peers).toMatchObject({metric:'EV/EBITDA',min:6,median:8,max:10,peerSet:['A','B'],sourceWorkingRevisionId:identity.workingRevisionId});
    await expect(writePeers({...params,idempotencyKey:'stale',expected:{...identity,workingRevisionVersion:999}})).rejects.toMatchObject({code:'CANONICAL_IDENTITY_CAS_CONFLICT'});
  });

  it('fails unsupported forecast before typed or legacy mutation',async()=>{
    const key=`unsupported-${randomUUID()}`;
    await expect(writeWacc({organizationId:orgId,userId,legacyId,expected:identity,idempotencyKey:key,payload:{waccPercent:11,terminalMethod:'gordon',terminalGrowthPercent:2,netDebt:100,cashTaxRatePct:19,valuationAsOfDate:'2028-12-31',manualForecast:{years:[{year:2028,fcff:1}]}}})).rejects.toMatchObject({code:'NEEDS_DECISION'});
    const event=await txWrap((tx:any)=>tx.queryOne(`SELECT event_id FROM finance_valuation_input_command_events WHERE organization_id=? AND idempotency_key=?`,[orgId,key]));
    expect(event).toBeNull();
  });

  it('rejects invalid terminal and comps domains before events',async()=>{
    const base={organizationId:orgId,userId,legacyId,expected:identity};
    const badWacc=`bad-wacc-${randomUUID()}`; await expect(writeWacc({...base,idempotencyKey:badWacc,payload:{waccPercent:2,terminalMethod:'gordon',terminalGrowthPercent:2,netDebt:0,cashTaxRatePct:19,valuationAsOfDate:'2028-12-31'}})).rejects.toMatchObject({code:'NEEDS_DECISION'});
    const badPeers=`bad-peers-${randomUUID()}`; await expect(writePeers({...base,idempotencyKey:badPeers,payload:{metric:'EV/EBITDA',min:0,median:8,max:10,peerSet:['A']}})).rejects.toMatchObject({code:'NEEDS_DECISION'});
    const badMetric=`bad-metric-${randomUUID()}`;await expect(writePeers({...base,idempotencyKey:badMetric,payload:{metric:'EV/Revenue',min:6,median:8,max:10,peerSet:['A']}})).rejects.toMatchObject({code:'NEEDS_DECISION'});
    const rows=await txWrap((tx:any)=>tx.queryAll(`SELECT event_id FROM finance_valuation_input_command_events WHERE organization_id=? AND idempotency_key IN (?,?,?)`,[orgId,badWacc,badPeers,badMetric]));expect(rows).toHaveLength(0);
  });

  it('cold typed direct WACC, terminal and net debt produce exact canonical EV and equity',async()=>{
    const direct=await loadDirect(orgId,identity.businessVersionId);
    expect(Number(direct.direct_wacc_pct)).toBe(11);
    const terminal=computeGordon({fcffTerminalYear:110,gPct:Number(direct.terminal_growth_pct),waccPct:Number(direct.direct_wacc_pct)});
    expect(terminal.ok).toBe(true); if(!terminal.ok) return;
    const discounted=discountFlows({years:[{fiscalYear:2027,fcff:100},{fiscalYear:2028,fcff:110}],waccPct:Number(direct.direct_wacc_pct),terminalValue:terminal.terminalValue});
    const components=[{sequenceOrder:1,componentKind:'DEBT',sign:'SUBTRACT_FROM_EV',amountDecimal:Number(direct.net_debt_decimal),asOfDate:'2028-12-31',rationale:'golden'}];
    const equity=computeEquity(discounted.enterpriseValue,components); expect(equity.ok).toBe(true); if(!equity.ok)return;
    const methodResult=await findOrCreateMethod({organizationId:orgId,businessVersionId:identity.businessVersionId,methodType:'DCF_FCFF',createdBy:userId});
    expect(methodResult.ok).toBe(true); if(!methodResult.ok)return;
    await writeTerminal({organizationId:orgId,methodId:methodResult.method.id,convention:'GORDON_GROWTH',gPct:2,terminalValueDecimal:terminal.terminalValue,terminalSharePct:discounted.terminalSharePct,isPrimary:true,createdBy:userId,sourceWorkingRevisionId:identity.workingRevisionId,sourceWorkingRevisionVersion:identity.workingRevisionVersion});
    await writeBridge({organizationId:orgId,businessVersionId:identity.businessVersionId,asOfDate:'2028-12-31',enterpriseValueDecimal:discounted.enterpriseValue,equityValueDecimal:equity.equityValueDecimal,components,createdBy:userId,sourceWorkingRevisionId:identity.workingRevisionId,sourceWorkingRevisionVersion:identity.workingRevisionVersion});
    const cold=await txWrap(async(tx:any)=>({terminal:await tx.queryOne(`SELECT terminal_value_decimal,source_working_revision_id FROM finance_valuation_terminal WHERE method_id=?`,[methodResult.method.id]),bridge:await tx.queryOne(`SELECT enterprise_value_decimal,equity_value_decimal,source_working_revision_id FROM finance_valuation_ev_equity_bridge WHERE business_version_id=?`,[identity.businessVersionId])}));
    expect(Number(cold.terminal.terminal_value_decimal)).toBeCloseTo(terminal.terminalValue,8);
    expect(Number(cold.bridge.enterprise_value_decimal)).toBeCloseTo(discounted.enterpriseValue,8);
    expect(Number(cold.bridge.equity_value_decimal)).toBeCloseTo(discounted.enterpriseValue-100,8);
    expect(cold.bridge.source_working_revision_id).toBe(identity.workingRevisionId);
  });

  it('runs mounted-lineage canonical compute concurrently with exact replay and immutable receipt',async()=>{
    const key=`compute-${randomUUID()}`;
    const [a,b]=await Promise.all([runLegacyCompute({organizationId:orgId,userId,legacyId,idempotencyKey:key,requestId:'req-a'}),runLegacyCompute({organizationId:orgId,userId,legacyId,idempotencyKey:key,requestId:'req-b'})]);
    expect([a.replay,b.replay].sort()).toEqual([false,true]);expect(a.result.job.id).toBe(b.result.job.id);
    const terminal=computeGordon({fcffTerminalYear:74.1,gPct:2,waccPct:11});expect(terminal.ok).toBe(true);if(!terminal.ok)return;
    const expected=discountFlows({years:[{fiscalYear:2027,fcff:66},{fiscalYear:2028,fcff:74.1}],waccPct:11,terminalValue:terminal.terminalValue});
    expect(a.result.enterpriseValue).toBeCloseTo(expected.enterpriseValue,8);expect(a.result.equityValue).toBeCloseTo(expected.enterpriseValue-100,8);
    const receipt=await txWrap((tx:any)=>tx.queryOne(`SELECT job_id,enterprise_value_decimal,equity_value_decimal FROM finance_valuation_compute_command_receipts WHERE organization_id=? AND idempotency_key=?`,[orgId,key]));expect(receipt.job_id).toBe(a.result.job.id);
    await expect(txWrap((tx:any)=>tx.queryRun(`UPDATE finance_valuation_compute_command_receipts SET enterprise_value_decimal=1 WHERE organization_id=? AND idempotency_key=?`,[orgId,key]))).rejects.toThrow(/append-only/);
    await expect(txWrap((tx:any)=>tx.queryRun(`DELETE FROM finance_valuation_input_command_events WHERE event_id=(SELECT event_id FROM finance_valuation_input_command_events WHERE organization_id=? LIMIT 1)`,[orgId]))).rejects.toThrow(/append-only/);
    const currencyRow=await txWrap((tx:any)=>tx.queryOne(`UPDATE finance_baseline_outputs SET presentation_currency='USD' WHERE id=(SELECT id FROM finance_baseline_outputs WHERE organization_id=? AND consolidation_scope='CONSOLIDATED' ORDER BY id LIMIT 1) RETURNING id`,[orgId]));
    await expect(runLegacyCompute({organizationId:orgId,userId,legacyId,idempotencyKey:key})).rejects.toMatchObject({code:'IDEMPOTENCY_KEY_REUSED'});
    await txWrap((tx:any)=>tx.queryRun(`UPDATE finance_baseline_outputs SET presentation_currency='PLN' WHERE id=?`,[currencyRow.id]));
    await txWrap((tx:any)=>tx.queryRun(`UPDATE finance_stmt_lines SET value_decimal=value_decimal+1 WHERE id=(SELECT s.id FROM finance_stmt_lines s JOIN financial_statement_lines l ON l.id=s.canonical_line_id WHERE s.organization_id=? AND l.line_code='WORKING_CAPITAL' LIMIT 1)`,[orgId]));
    await expect(runLegacyCompute({organizationId:orgId,userId,legacyId,idempotencyKey:key})).rejects.toMatchObject({code:'IDEMPOTENCY_KEY_REUSED'});
    await txWrap((tx:any)=>tx.queryRun(`UPDATE finance_baseline_outputs SET value_decimal=value_decimal+1 WHERE id=(SELECT o.id FROM finance_baseline_outputs o JOIN financial_statement_lines l ON l.id=o.canonical_line_id JOIN finance_stmt_periods p ON p.period_id=o.period_id WHERE o.organization_id=? AND l.line_code='EBIT' AND p.fiscal_year=2027 LIMIT 1)`,[orgId]));
    await expect(runLegacyCompute({organizationId:orgId,userId,legacyId,idempotencyKey:key})).rejects.toMatchObject({code:'IDEMPOTENCY_KEY_REUSED'});
    await writeWacc({organizationId:orgId,userId,legacyId,expected:identity,idempotencyKey:`changed-${randomUUID()}`,payload:{waccPercent:12,terminalMethod:'gordon',terminalGrowthPercent:2,netDebt:100,cashTaxRatePct:19,valuationAsOfDate:'2028-12-31',manualForecast:{years:[]}}});
    await expect(runLegacyCompute({organizationId:orgId,userId,legacyId,idempotencyKey:key})).rejects.toMatchObject({code:'IDEMPOTENCY_KEY_REUSED'});
  });

  it('mounts the canonical HTTP compute door and cold-reads the exact persisted result',async()=>{
    const {default:valuationRouter}=await import('../../../../routes/v8/finance-v2/valuation.routes.js');
    const app=express();
    app.use(express.json());
    app.use((req:any,_res,next)=>{req.v8Context={organizationId:orgId,userId};next();});
    app.use('/api/v8/finance-v2',valuationRouter);
    const key=`mounted-compute-${randomUUID()}`;
    const first=await request(app).post(`/api/v8/finance-v2/valuation/legacy/${legacyId}/compute`).set('x-idempotency-key',key).set('x-request-id','mounted-a');
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({artifactId:identity.artifactId,businessVersionId:identity.businessVersionId,replay:false});
    const replay=await request(app).post(`/api/v8/finance-v2/valuation/legacy/${legacyId}/compute`).set('x-idempotency-key',key).set('x-request-id','mounted-b');
    expect(replay.status).toBe(200);expect(replay.body.data.replay).toBe(true);expect(replay.body.data.jobId).toBe(first.body.data.jobId);
    const cold=await txWrap((tx:any)=>tx.queryOne(`SELECT job_id,enterprise_value_decimal,equity_value_decimal FROM finance_valuation_compute_command_receipts WHERE organization_id=? AND idempotency_key=?`,[orgId,key]));
    expect(cold.job_id).toBe(first.body.data.jobId);expect(Number(cold.enterprise_value_decimal)).toBeCloseTo(Number(first.body.data.enterpriseValue),8);expect(Number(cold.equity_value_decimal)).toBeCloseTo(Number(first.body.data.equityValue),8);
  });

  it('generates one canonical negotiation pack, replays exactly, projects compatibly and checks authority before replay',async()=>{
    await txWrap((tx:any)=>tx.queryRun(`UPDATE valuations SET status='APPROVED' WHERE organization_id=? AND id=?`,[orgId,legacyId]));
    const key=`negotiation-${randomUUID()}`;
    const params={organizationId:orgId,userId,legacyId,expected:identity,idempotencyKey:key};
    const results=await Promise.all(Array.from({length:8},()=>generateNegotiationPack(params)));
    expect(results.filter((row:any)=>row.replay===false)).toHaveLength(1);
    expect(results.filter((row:any)=>row.replay===true)).toHaveLength(7);
    expect(new Set(results.map((row:any)=>row.sourceResultSha256)).size).toBe(1);
    const first=results[0];
    const cold=await txWrap(async(tx:any)=>({
      pack:await tx.queryOne(`SELECT source_result_sha256,pack_json FROM finance_valuation_negotiation_packs WHERE organization_id=? AND business_version_id=?`,[orgId,identity.businessVersionId]),
      receipts:await tx.queryAll(`SELECT request_sha256,response_json FROM finance_valuation_negotiation_pack_receipts WHERE organization_id=? AND idempotency_key=?`,[orgId,key]),
      legacy:await tx.queryOne(`SELECT negotiation_pack FROM valuations WHERE organization_id=? AND id=?`,[orgId,legacyId]),
    }));
    expect(cold.receipts).toHaveLength(1);expect(cold.pack.source_result_sha256).toBe(first.sourceResultSha256);expect(cold.pack.pack_json).toEqual(first.pack);expect(cold.legacy.negotiation_pack).toEqual(first.pack);
    await expect(generateNegotiationPack({...params,expected:{...identity,workingRevisionVersion:999}})).rejects.toMatchObject({code:'CANONICAL_IDENTITY_CAS_CONFLICT'});
    await expect(txWrap((tx:any)=>tx.queryRun(`UPDATE finance_valuation_negotiation_pack_receipts SET request_sha256=repeat('0',64) WHERE organization_id=? AND idempotency_key=?`,[orgId,key]))).rejects.toThrow(/append-only/);
    await expect(txWrap((tx:any)=>tx.queryRun(`DELETE FROM finance_valuation_negotiation_pack_receipts WHERE organization_id=? AND idempotency_key=?`,[orgId,key]))).rejects.toThrow(/append-only/);
    await txWrap((tx:any)=>tx.queryRun(`UPDATE organization_members SET status='REVOKED' WHERE organization_id=? AND user_id=?`,[orgId,userId]));
    await expect(generateNegotiationPack(params)).rejects.toMatchObject({code:'ORG_MEMBERSHIP_REVOKED'});
    await txWrap((tx:any)=>tx.queryRun(`UPDATE organization_members SET status='ACTIVE' WHERE organization_id=? AND user_id=?`,[orgId,userId]));
    expect((await generateNegotiationPack(params)).replay).toBe(true);
  });

  it('renders one real canonical PPTX with byte hash, exact replay and authority before replay',async()=>{
    const key=`pptx-${randomUUID()}`;const params={organizationId:orgId,userId,legacyId,expected:identity,idempotencyKey:key,options:{language:'en' as const,theme:'corporate' as const,confidentiality:'confidential' as const}};
    const [first,replay]=await Promise.all([exportPptx(params),exportPptx(params)]);
    expect([first.replay,replay.replay].sort()).toEqual([false,true]);expect(first.exportReceiptId).toBe(replay.exportReceiptId);expect(first.outputContentHash).toBe(replay.outputContentHash);
    const cold=await txWrap(async(tx:any)=>({receipt:await tx.queryOne(`SELECT status,source_content_hash,output_content_hash,output_byte_size FROM artifact_export_receipts WHERE organization_id=? AND idempotency_key=?`,[orgId,key]),binding:await tx.queryOne(`SELECT export_path,slide_count,output_content_hash FROM finance_valuation_pptx_exports WHERE organization_id=? AND export_receipt_id=?`,[orgId,first.exportReceiptId]),legacy:await tx.queryOne(`SELECT export_path,exported_at FROM valuations WHERE organization_id=? AND id=?`,[orgId,legacyId])}));
    expect(cold.receipt).toMatchObject({status:'succeeded',source_content_hash:first.sourceContentHash,output_content_hash:first.outputContentHash});expect(Number(cold.receipt.output_byte_size)).toBeGreaterThan(1000);expect(cold.binding.export_path).toBe(cold.legacy.export_path);expect(cold.legacy.exported_at).toBeTruthy();
    const filePath=cold.binding.export_path.replace('/exports/valuations/',`${exportsDir('valuations')}/`);const bytes=fs.readFileSync(filePath);expect(bytes.subarray(0,2).toString()).toBe('PK');
    await expect(txWrap((tx:any)=>tx.queryRun(`UPDATE artifact_export_receipts SET output_byte_size=1 WHERE organization_id=? AND idempotency_key=?`,[orgId,key]))).rejects.toThrow(/terminal|immutable/);
    await txWrap((tx:any)=>tx.queryRun(`UPDATE organization_members SET status='REVOKED' WHERE organization_id=? AND user_id=?`,[orgId,userId]));await expect(exportPptx(params)).rejects.toMatchObject({code:'ORG_MEMBERSHIP_REVOKED'});await txWrap((tx:any)=>tx.queryRun(`UPDATE organization_members SET status='ACTIVE' WHERE organization_id=? AND user_id=?`,[orgId,userId]));expect((await exportPptx(params)).replay).toBe(true);
    fs.unlinkSync(filePath);
  });

  it('rolls back method, terminal and bridge publication when receipt insertion fails',async()=>{
    const snapshot=()=>txWrap(async(tx:any)=>({methods:await tx.queryAll(`SELECT id,readiness,result_value_status,result_ev_decimal::text FROM finance_valuation_methods WHERE organization_id=? AND business_version_id=? ORDER BY id`,[orgId,identity.businessVersionId]),terminal:await tx.queryAll(`SELECT t.method_id,t.convention,t.terminal_value_decimal::text FROM finance_valuation_terminal t JOIN finance_valuation_methods m ON m.id=t.method_id WHERE m.organization_id=? AND m.business_version_id=? ORDER BY t.method_id,t.convention`,[orgId,identity.businessVersionId]),bridge:await tx.queryAll(`SELECT enterprise_value_decimal::text,equity_value_decimal::text FROM finance_valuation_ev_equity_bridge WHERE organization_id=? AND business_version_id=?`,[orgId,identity.businessVersionId])}));
    const before=await snapshot();
    await txWrap(async(tx:any)=>{await tx.queryRun(`CREATE OR REPLACE FUNCTION test_fail_finance_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.idempotency_key LIKE 'fail-receipt-%' THEN RAISE EXCEPTION 'forced receipt failure'; END IF; RETURN NEW; END $$`);await tx.queryRun(`DROP TRIGGER IF EXISTS trg_test_fail_finance_receipt ON finance_valuation_compute_command_receipts`);await tx.queryRun(`CREATE TRIGGER trg_test_fail_finance_receipt BEFORE INSERT ON finance_valuation_compute_command_receipts FOR EACH ROW EXECUTE FUNCTION test_fail_finance_receipt()`);});
    const key=`fail-receipt-${randomUUID()}`;
    await expect(runLegacyCompute({organizationId:orgId,userId,legacyId,idempotencyKey:key})).rejects.toThrow(/forced receipt failure/);
    expect(await snapshot()).toEqual(before);
    const receipt=await txWrap((tx:any)=>tx.queryOne(`SELECT job_id FROM finance_valuation_compute_command_receipts WHERE organization_id=? AND idempotency_key=?`,[orgId,key]));expect(receipt).toBeNull();
    await txWrap(async(tx:any)=>{await tx.queryRun(`DROP TRIGGER trg_test_fail_finance_receipt ON finance_valuation_compute_command_receipts`);await tx.queryRun(`DROP FUNCTION test_fail_finance_receipt()`);});
  });

  it('detects an opening-WC race after fingerprint and rolls back receipt/publication',async()=>{
    const snapshot=()=>txWrap(async(tx:any)=>({methods:await tx.queryAll(`SELECT id,readiness,result_ev_decimal::text FROM finance_valuation_methods WHERE organization_id=? AND business_version_id=? ORDER BY id`,[orgId,identity.businessVersionId]),terminal:await tx.queryAll(`SELECT t.method_id,t.terminal_value_decimal::text FROM finance_valuation_terminal t JOIN finance_valuation_methods m ON m.id=t.method_id WHERE m.organization_id=? AND m.business_version_id=? ORDER BY t.method_id`,[orgId,identity.businessVersionId]),bridge:await tx.queryAll(`SELECT enterprise_value_decimal::text,equity_value_decimal::text FROM finance_valuation_ev_equity_bridge WHERE organization_id=? AND business_version_id=?`,[orgId,identity.businessVersionId])}));
    await txWrap((tx:any)=>tx.queryRun(`UPDATE finance_stmt_lines SET value_decimal=value_decimal+1 WHERE id=(SELECT s.id FROM finance_stmt_lines s JOIN financial_statement_lines l ON l.id=s.canonical_line_id WHERE s.organization_id=? AND l.line_code='WORKING_CAPITAL' LIMIT 1)`,[orgId]));
    await txWrap(async(tx:any)=>{await tx.queryRun(`CREATE OR REPLACE FUNCTION test_barrier_finance_job() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.request_id='opening-race-barrier' THEN PERFORM pg_advisory_xact_lock(987654321); END IF; RETURN NEW; END $$`);await tx.queryRun(`DROP TRIGGER IF EXISTS trg_test_barrier_finance_job ON compute_jobs`);await tx.queryRun(`CREATE TRIGGER trg_test_barrier_finance_job BEFORE INSERT ON compute_jobs FOR EACH ROW EXECUTE FUNCTION test_barrier_finance_job()`);});
    let release!:()=>void;let locked!:()=>void;const released=new Promise<void>(resolve=>{release=resolve});const ready=new Promise<void>(resolve=>{locked=resolve});
    const holder=txWrap(async(tx:any)=>{await tx.queryOne(`SELECT pg_advisory_xact_lock(987654321)`);locked();await released;});await ready;
    const before=await snapshot(),key=`opening-race-${randomUUID()}`;
    const compute=runLegacyCompute({organizationId:orgId,userId,legacyId,idempotencyKey:key,requestId:'opening-race-barrier'});const rejected=expect(compute).rejects.toMatchObject({code:'CANONICAL_SOURCE_CAS_CONFLICT'});
    await new Promise(resolve=>setTimeout(resolve,100));
    await txWrap((tx:any)=>tx.queryRun(`UPDATE finance_stmt_lines SET value_decimal=value_decimal+7 WHERE id=(SELECT s.id FROM finance_stmt_lines s JOIN financial_statement_lines l ON l.id=s.canonical_line_id WHERE s.organization_id=? AND l.line_code='WORKING_CAPITAL' LIMIT 1)`,[orgId]));
    release();await holder;await rejected;expect(await snapshot()).toEqual(before);
    expect(await txWrap((tx:any)=>tx.queryOne(`SELECT job_id FROM finance_valuation_compute_command_receipts WHERE organization_id=? AND idempotency_key=?`,[orgId,key]))).toBeNull();
    await txWrap(async(tx:any)=>{await tx.queryRun(`DROP TRIGGER trg_test_barrier_finance_job ON compute_jobs`);await tx.queryRun(`DROP FUNCTION test_barrier_finance_job()`);});
  });

  it('fails closed when the canonical alias changes while the prior BV input lock is awaited',async()=>{
    const alternate=await createArtifact({organizationId:orgId,artifactType:'VALUATION_CASE',naturalKey:`wave4-alias-race-${randomUUID()}`,createdBy:userId});
    await txWrap((tx:any)=>tx.queryRun(`UPDATE finance_artifacts SET current_business_version_id=? WHERE artifact_id=? AND organization_id=?`,[alternate.businessVersion.business_version_id,alternate.artifact.artifact_id,orgId]));
    let release!:()=>void;let locked!:()=>void;
    const releasePromise=new Promise<void>(resolve=>{release=resolve;});const lockedPromise=new Promise<void>(resolve=>{locked=resolve;});
    const holder=txWrap(async(tx:any)=>{await tx.queryOne(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`,[`${orgId}:${identity.businessVersionId}:VALUATION_INPUTS`]);locked();await releasePromise;});
    await lockedPromise;
    const key=`alias-race-${randomUUID()}`;
    const compute=runLegacyCompute({organizationId:orgId,userId,legacyId,idempotencyKey:key});
    const rejected=expect(compute).rejects.toMatchObject({code:'CANONICAL_IDENTITY_CAS_CONFLICT'});
    await new Promise(resolve=>setTimeout(resolve,100));
    await txWrap((tx:any)=>tx.queryRun(`UPDATE finance_artifact_aliases SET artifact_id=?,business_version_id=? WHERE organization_id=? AND legacy_table='valuations' AND legacy_id=?`,[alternate.artifact.artifact_id,alternate.businessVersion.business_version_id,orgId,legacyId]));
    release();await holder;
    await rejected;
    await txWrap((tx:any)=>tx.queryRun(`UPDATE finance_artifact_aliases SET artifact_id=?,business_version_id=? WHERE organization_id=? AND legacy_table='valuations' AND legacy_id=?`,[identity.artifactId,identity.businessVersionId,orgId,legacyId]));
    const receipt=await txWrap((tx:any)=>tx.queryOne(`SELECT job_id FROM finance_valuation_compute_command_receipts WHERE organization_id=? AND idempotency_key=?`,[orgId,key]));expect(receipt).toBeNull();
  });

  it('soft-discards one exact mapped valuation, converges, replays after archival and hides it without deleting lineage',async()=>{
    await txWrap(async(tx:any)=>{
      await tx.queryRun(`UPDATE valuations SET status='DRAFT' WHERE organization_id=? AND id=?`,[orgId,legacyId]);
      await tx.queryRun(`UPDATE finance_artifacts SET archived_at=NULL,archived_reason=NULL WHERE organization_id=? AND artifact_id=?`,[orgId,identity.artifactId]);
    });
    const key=`discard-${randomUUID()}`;
    const params={organizationId:orgId,userId,legacyId,expected:identity,idempotencyKey:key,reason:'Owner discarded draft valuation'};
    const {default:valuationRouter}=await import('../../../../routes/v8/finance-v2/valuation.routes.js');
    const app=express();app.use(express.json());app.use((req:any,_res,next)=>{req.v8Context={organizationId:orgId,userId};next();});app.use('/api/v8/finance-v2',valuationRouter);
    const requestDiscard=()=>request(app).delete(`/api/v8/finance-v2/valuation/legacy/${legacyId}`).set('x-idempotency-key',key).send({expected:identity,reason:params.reason});
    const [firstHttp,replayHttp]=await Promise.all([requestDiscard(),requestDiscard()]);
    expect(firstHttp.status).toBe(200);expect(replayHttp.status).toBe(200);
    const [first,replay]=[firstHttp.body.data,replayHttp.body.data];
    expect([first.replay,replay.replay].sort()).toEqual([false,true]);
    expect(first).toMatchObject({...identity,legacyValuationId:legacyId,status:'ARCHIVED'});
    const retryIdentity=await request(app).get(`/api/v8/finance-v2/valuation/legacy/${legacyId}/input-identity`);
    expect(retryIdentity.status).toBe(200);expect(retryIdentity.body.data).toEqual(identity);
    expect((await discardValuation(params)).replay).toBe(true);
    await expect(discardValuation({...params,reason:'different reason'})).rejects.toMatchObject({code:'IDEMPOTENCY_KEY_REUSED'});
    const cold=await txWrap(async(tx:any)=>({
      valuation:await tx.queryOne(`SELECT status,title FROM valuations WHERE organization_id=? AND id=?`,[orgId,legacyId]),
      artifact:await tx.queryOne(`SELECT archived_at,archived_reason FROM finance_artifacts WHERE organization_id=? AND artifact_id=?`,[orgId,identity.artifactId]),
      receipts:await tx.queryAll(`SELECT prior_status,reason,created_by FROM finance_valuation_discard_receipts WHERE organization_id=? AND legacy_valuation_id=?`,[orgId,legacyId]),
      alias:await tx.queryOne(`SELECT artifact_id,business_version_id FROM finance_artifact_aliases WHERE organization_id=? AND legacy_table='valuations' AND legacy_id=?`,[orgId,legacyId]),
      bv:await tx.queryOne(`SELECT business_version_id FROM finance_business_versions WHERE organization_id=? AND business_version_id=?`,[orgId,identity.businessVersionId]),
      wr:await tx.queryOne(`SELECT working_revision_id FROM finance_working_revisions WHERE organization_id=? AND working_revision_id=?`,[orgId,identity.workingRevisionId]),
    }));
    expect(cold.valuation.status).toBe('ARCHIVED');expect(cold.artifact.archived_at).toBeTruthy();expect(cold.artifact.archived_reason).toBe(params.reason);
    expect(cold.receipts).toEqual([{prior_status:'DRAFT',reason:params.reason,created_by:userId}]);
    expect(cold.alias).toEqual({artifact_id:identity.artifactId,business_version_id:identity.businessVersionId});expect(cold.bv).not.toBeNull();expect(cold.wr).not.toBeNull();
    expect((await listLegacyValuations(orgId)).some((row:any)=>row.id===legacyId)).toBe(false);
    expect(await getLegacyValuation(orgId,legacyId)).toBeNull();
    await expect(readInputs(orgId,legacyId)).rejects.toMatchObject({code:'STATUS_IMMUTABLE'});
    await expect(txWrap((tx:any)=>tx.queryRun(`UPDATE finance_valuation_discard_receipts SET reason='tampered' WHERE organization_id=? AND idempotency_key=?`,[orgId,key]))).rejects.toThrow(/immutable/);
    await expect(txWrap((tx:any)=>tx.queryRun(`DELETE FROM finance_valuation_discard_receipts WHERE organization_id=? AND idempotency_key=?`,[orgId,key]))).rejects.toThrow(/immutable/);
    await expect(txWrap((tx:any)=>tx.queryRun(`DELETE FROM valuations WHERE organization_id=? AND id=?`,[orgId,legacyId]))).rejects.toThrow(/archived valuation is immutable/);
    await txWrap((tx:any)=>tx.queryRun(`UPDATE organization_members SET status='REVOKED' WHERE organization_id=? AND user_id=?`,[orgId,userId]));
    await expect(discardValuation(params)).rejects.toMatchObject({code:'ORG_MEMBERSHIP_REVOKED'});
    await txWrap((tx:any)=>tx.queryRun(`UPDATE organization_members SET status='ACTIVE' WHERE organization_id=? AND user_id=?`,[orgId,userId]));
  });
});
