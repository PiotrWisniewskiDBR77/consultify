/**
 * Finance v3 canonical adapter — Enterprise Valuation surface, `/api/v8/finance-v2/valuation/*`
 * (+ `/valuation/methods/:methodId/*` for method-scoped sub-resources).
 *
 * Pakiet B3 (Valuation HTTP Surface) — closes the LAST zero-coverage domain in `/finance-v2`
 * (Pakiet B2 report §2.6/§6: "Valuation — 0 endpointów, całkowicie NIEPOKRYTE"). Wraps seven
 * existing compute/domain services (`valuationComputeService`/`valuationWaccService`/
 * `valuationTerminalService`/`valuationDiscountService`/`valuationBridgeService`/
 * `valuationSensitivityService`/`valuationAdvisorService`) that Gate D / Fala 7 (WP-D10) already
 * built and unit/pg-tested in isolation, plus the new `valuationVariantService.ts` this package adds
 * to register Cases/Variants (the one write path that had ZERO caller anywhere before this package —
 * see that file's header).
 *
 * Router-only: every DB statement lives in `services/finance/canonical/valuation*.ts`. No domain
 * logic here — only body validation, org-scoping (via the resource's own owning
 * variant/method/case), and HTTP status mapping, same constraint every other file under this
 * directory documents (see `statements.routes.ts`'s header for the canonical statement of it).
 */

import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../../../middleware/auth.middleware.js';
import { getV8Context } from '../../../middleware/v8Auth.middleware.js';
import { requireActiveMembership, requireFinanceEditorMembership } from '../../../services/legacyCutover/requireActiveMembership.js';
import { getBusinessVersion } from '../../../services/finance/canonical/artifactVersionService.js';
import {
  compareVariantsForAdvisor,
  evaluateAdvisorRules,
  generateValuationAdvisorOutput,
  listAdvisorOutputs,
  loadValuationSnapshot,
  resolveHeadlineEnterpriseValue,
  type CompareVariantsParams,
  type GenerateValuationAdvisorOutputParams,
} from '../../../services/finance/canonical/valuationAdvisorService.js';
import {
  getBridge,
  computeEquityValue,
  writeBridge,
  type BridgeComponentInput,
  type BridgeComponentKind,
  type BridgeComponentSign,
  type WriteBridgeParams,
} from '../../../services/finance/canonical/valuationBridgeService.js';
import {
  computeWeightedRecommendation,
  findOrCreateMethod,
  getMethod,
  listMethods,
  runDcfFcffValuation,
  setBasketWeights,
  type MethodRow,
  type MethodType,
  type RunDcfFcffValuationParams,
} from '../../../services/finance/canonical/valuationComputeService.js';
import { buildWaccByTerminalGGrid, getSensitivityGrid, writeSensitivityGrid, type SensitivityAxisValues } from '../../../services/finance/canonical/valuationSensitivityService.js';
import { listTerminalRows } from '../../../services/finance/canonical/valuationTerminalService.js';
import {
  createCase,
  createVariant,
  getCase,
  getVariant,
  listCases,
  listVariants,
  renameVariant,
} from '../../../services/finance/canonical/valuationVariantService.js';
import { loadWaccInputs, upsertWaccInputs, type UpsertWaccInputsParams } from '../../../services/finance/canonical/valuationWaccService.js';
import { getPinnedLegacyValuationIdentity, readCanonicalLegacyValuationInputs, writeCanonicalLegacyPeers, writeCanonicalLegacyValuationDepth, writeCanonicalLegacyWacc } from '../../../services/finance/canonical/valuationLegacySuccessorService.js';
import { runCanonicalLegacyValuationCompute } from '../../../services/finance/canonical/valuationLegacyComputeAdapterService.js';
import { generateCanonicalLegacyNegotiationPack } from '../../../services/finance/canonical/valuationNegotiationPackService.js';
import { exportCanonicalLegacyValuationPptx } from '../../../services/finance/canonical/valuationPptxExportService.js';
import { createRegisteredValuation, ValuationRegistrationError } from '../../../services/finance/canonical/valuationRegistrationService.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { financeV2Meta, sendError } from './_shared.js';

const router = Router();

const VALID_METHOD_TYPES: readonly MethodType[] = [
  'DCF_FCFF',
  'DCF_FCFE',
  'DIVIDEND_DISCOUNT',
  'TRADING_COMPS',
  'PRECEDENT_TRANSACTIONS',
  'ASSET_BASED',
  'OTHER_WITH_POLICY',
];

const VALID_BRIDGE_KINDS: readonly BridgeComponentKind[] = [
  'DEBT',
  'LEASES',
  'PENSIONS_PROVISIONS',
  'MINORITIES',
  'ASSOCIATES_INVESTMENTS',
  'CASH',
  'RESTRICTED_CASH',
  'NON_OPERATING_ASSETS',
  'OPTIONS_DILUTION',
  'OTHER',
];
const VALID_BRIDGE_SIGNS: readonly BridgeComponentSign[] = ['SUBTRACT_FROM_EV', 'ADD_TO_EV'];

const valuationRegistrationSchema=z.object({
  title:z.string().trim().min(1).max(300),
  description:z.string().max(10000).nullish(),
  projectId:z.string().trim().min(1).max(255).nullish(),
  initiativeId:z.string().trim().min(1).max(255).nullish(),
  sourceType:z.enum(['financial_model','financial_analysis','budget','manual']),
  sourceId:z.string().trim().min(1).max(255).nullish(),
  horizonYears:z.number().int().min(1).max(20).optional(),
  currency:z.string().trim().min(1).max(10).optional(),
  depth:z.enum(['managerial','banking']).optional(),
}).strict().superRefine((body,ctx)=>{
  if(body.sourceType!=='manual'&&!body.sourceId){
    ctx.addIssue({code:z.ZodIssueCode.custom,path:['sourceId'],message:'sourceId is required'});
  }
  if(body.sourceType==='manual'&&body.sourceId){
    ctx.addIssue({code:z.ZodIssueCode.custom,path:['sourceId'],message:'manual registration cannot bind sourceId'});
  }
});

router.post('/valuation/registrations', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { organizationId, userId } = getV8Context(req);
  const parsed=valuationRegistrationSchema.safeParse(req.body??{});
  if(!parsed.success) return sendError(res,400,'INVALID_BODY',parsed.error.issues.map(issue=>`${issue.path.join('.')}: ${issue.message}`).join('; '));
  const body=parsed.data;
  const idempotencyKey = String(req.header('Idempotency-Key') || '').trim();
  if (!idempotencyKey) return sendError(res,400,'IDEMPOTENCY_KEY_REQUIRED','Idempotency-Key is required');
  try {
    const result = await createRegisteredValuation({
      organizationId,userId,title:body.title,
      description:body.description??undefined,
      projectId:body.projectId??undefined,
      initiativeId:body.initiativeId??undefined,
      sourceType:body.sourceType,
      sourceId:body.sourceId??null,
      horizonYears:body.horizonYears,
      currency:body.currency,
      depth:body.depth,
      idempotencyKey,
      actor:{userId,userEmail:(req.user as any)?.email,ip:req.ip,userAgent:req.get('user-agent')||undefined},
    });
    return res.status(result.replay ? 200 : 201).json({data:result,meta:financeV2Meta()});
  } catch (error) {
    if (error instanceof ValuationRegistrationError) {
      return sendError(res,error.status,error.code,error.message);
    }
    const message=String((error as any)?.message||'');
    if (message==='Missing sourceId') return sendError(res,400,'SOURCE_ID_REQUIRED',message);
    if (/^Source .* not found$/.test(message)) return sendError(res,404,'SOURCE_NOT_FOUND','Valuation source not found');
    if (/must be approved before it can seed a valuation$/.test(message)) return sendError(res,409,'SOURCE_NOT_APPROVED',message);
    throw error;
  }
}));

router.get('/valuation/legacy/:legacyId/input-identity', requireActiveMembership, asyncHandler(async (req: AuthRequest,res:Response) => {
  const {organizationId}=getV8Context(req);
  const identity=await getPinnedLegacyValuationIdentity(organizationId,String(req.params.legacyId||''));
  if(!identity) return sendError(res,409,'LEGACY_IDENTITY_UNMAPPED','No exact canonical valuation identity');
  return res.status(200).json({data:{artifactId:identity.artifact_id,businessVersionId:identity.business_version_id,workingRevisionId:identity.working_revision_id,workingRevisionVersion:Number(identity.working_revision_version)},meta:financeV2Meta()});
}));

router.get('/valuation/legacy/:legacyId/inputs',requireActiveMembership,asyncHandler(async(req:AuthRequest,res:Response)=>{
  const {organizationId}=getV8Context(req);
  try{const result=await readCanonicalLegacyValuationInputs(organizationId,String(req.params.legacyId||''));return res.status(200).json({data:{artifactId:result.identity.artifact_id,businessVersionId:result.identity.business_version_id,workingRevisionId:result.identity.working_revision_id,workingRevisionVersion:Number(result.identity.working_revision_version),assumptions:result.assumptions,peers:result.peers},meta:financeV2Meta()});}
  catch(error:any){const code=String(error?.code||'CANONICAL_INPUT_READ_FAILED');return sendError(res,409,code,String(error?.message||code));}
}));

router.post('/valuation/legacy/:legacyId/compute',requireFinanceEditorMembership,asyncHandler(async(req:AuthRequest,res:Response)=>{
  const {organizationId,userId}=getV8Context(req);
  const idempotencyKey=String(req.headers['x-idempotency-key']||'').trim();if(!idempotencyKey)return sendError(res,400,'IDEMPOTENCY_KEY_REQUIRED','x-idempotency-key is required');
  try{const computed=await runCanonicalLegacyValuationCompute({organizationId,userId,legacyId:String(req.params.legacyId||''),idempotencyKey,requestId:typeof req.headers['x-request-id']==='string'?req.headers['x-request-id']:null});return res.status(200).json({data:{artifactId:computed.identity.artifact_id,businessVersionId:computed.identity.business_version_id,workingRevisionId:computed.identity.working_revision_id,workingRevisionVersion:Number(computed.identity.working_revision_version),jobId:computed.result.job.id,enterpriseValue:computed.result.enterpriseValue,equityValue:computed.result.equityValue,terminalValue:computed.result.terminalValue,wacc:'wacc' in computed.result?computed.result.wacc:undefined,replay:computed.replay},meta:financeV2Meta()});}catch(error:any){const code=String(error?.code||'CANONICAL_COMPUTE_FAILED');return sendError(res,code.includes('MISSING')?422:409,code,String(error?.message||code));}
}));

router.post('/valuation/legacy/:legacyId/negotiation-pack',requireFinanceEditorMembership,asyncHandler(async(req:AuthRequest,res:Response)=>{
  const {organizationId,userId}=getV8Context(req);const body=req.body??{};
  const idempotencyKey=String(req.headers['x-idempotency-key']||'').trim();
  if(!idempotencyKey)return sendError(res,400,'IDEMPOTENCY_KEY_REQUIRED','x-idempotency-key is required');
  if(!body.expected||typeof body.expected!=='object')return sendError(res,400,'INVALID_BODY','expected canonical identity is required');
  try{const result=await generateCanonicalLegacyNegotiationPack({organizationId,userId,legacyId:String(req.params.legacyId||''),expected:body.expected,idempotencyKey});return res.status(200).json({data:result,meta:financeV2Meta()});}
  catch(error:any){const code=String(error?.code||'CANONICAL_NEGOTIATION_PACK_FAILED');const status=code==='LEGACY_IDENTITY_UNMAPPED'?404:code==='IDEMPOTENCY_KEY_REQUIRED'?400:code==='CANONICAL_RESULTS_NOT_READY'?422:409;return sendError(res,status,code,String(error?.message||code));}
}));

router.post('/valuation/legacy/:legacyId/export/pptx',requireFinanceEditorMembership,asyncHandler(async(req:AuthRequest,res:Response)=>{
  const {organizationId,userId}=getV8Context(req);const body=req.body??{};const idempotencyKey=String(req.headers['x-idempotency-key']||'').trim();
  if(!idempotencyKey)return sendError(res,400,'IDEMPOTENCY_KEY_REQUIRED','x-idempotency-key is required');
  if(!body.expected||typeof body.expected!=='object')return sendError(res,400,'INVALID_BODY','expected canonical identity is required');
  const language=body.language==='pl'?'pl':'en';const theme=['minimal','modern'].includes(body.theme)?body.theme:'corporate';const confidentiality=['public','internal'].includes(body.confidentiality)?body.confidentiality:'confidential';
  try{const result=await exportCanonicalLegacyValuationPptx({organizationId,userId,legacyId:String(req.params.legacyId||''),expected:body.expected,idempotencyKey,options:{language,theme,confidentiality}});return res.status(200).json({data:result,meta:financeV2Meta()});}
  catch(error:any){const code=String(error?.code||'CANONICAL_PPTX_EXPORT_FAILED');const status=code==='LEGACY_IDENTITY_UNMAPPED'?404:code==='IDEMPOTENCY_KEY_REQUIRED'?400:code==='CANONICAL_RESULTS_NOT_READY'?422:409;return sendError(res,status,code,String(error?.message||code));}
}));

router.put('/valuation/legacy/:legacyId/depth',requireFinanceEditorMembership,asyncHandler(async(req:AuthRequest,res:Response)=>{
  const {organizationId,userId}=getV8Context(req); const body=req.body??{};
  const idempotencyKey=String(req.headers['x-idempotency-key']||'').trim();
  if(!idempotencyKey) return sendError(res,400,'IDEMPOTENCY_KEY_REQUIRED','x-idempotency-key is required');
  if(!body.expected||typeof body.expected!=='object'||!['managerial','banking'].includes(body.depth)) return sendError(res,400,'INVALID_BODY','depth and expected identity are required');
  try{
    const result=await writeCanonicalLegacyValuationDepth({organizationId,userId,legacyId:String(req.params.legacyId||''),depth:body.depth,expected:body.expected,idempotencyKey,actor:{userId,userEmail:(req.user as any)?.email,ip:req.ip,userAgent:req.get('user-agent')||undefined}});
    return res.status(200).json({data:result,meta:financeV2Meta()});
  }catch(error:any){const code=String(error?.code||'CANONICAL_DEPTH_WRITE_FAILED');const status=code==='LEGACY_IDENTITY_UNMAPPED'?404:code==='INVALID_DEPTH'||code==='IDEMPOTENCY_KEY_REQUIRED'?400:409;return sendError(res,status,code,String(error?.message||code));}
}));

for(const [suffix,writer] of [['assumptions',writeCanonicalLegacyWacc],['peers',writeCanonicalLegacyPeers]] as const){
  router.put(`/valuation/legacy/:legacyId/${suffix}`,requireFinanceEditorMembership,asyncHandler(async(req:AuthRequest,res:Response)=>{
    const {organizationId,userId}=getV8Context(req); const body=req.body??{};
    const idempotencyKey=String(req.headers['x-idempotency-key']||'').trim();
    if(!idempotencyKey) return sendError(res,400,'IDEMPOTENCY_KEY_REQUIRED','x-idempotency-key is required');
    if(!body.payload||typeof body.payload!=='object'||Array.isArray(body.payload)||!body.expected) return sendError(res,400,'INVALID_BODY','typed payload and expected identity are required');
    try{
      const result=await writer({organizationId,userId,legacyId:String(req.params.legacyId||''),payload:body.payload,expected:body.expected,idempotencyKey});
      return res.status(200).json({data:{artifactId:result.identity.artifact_id,businessVersionId:result.identity.business_version_id,workingRevisionId:result.identity.working_revision_id,workingRevisionVersion:Number(result.identity.working_revision_version),requestSha256:result.requestSha256,replay:result.replay,readback:result.readback},meta:financeV2Meta()});
    }catch(error:any){const code=String(error?.code||'CANONICAL_INPUT_WRITE_FAILED'); return sendError(res,code==='NEEDS_DECISION'?422:409,code,String(error?.message||code));}
  }));
}

function mapMethod(m: MethodRow) {
  return {
    methodId: m.id,
    methodType: m.method_type,
    readiness: m.readiness,
    result: { status: m.result_value_status, valueDecimal: m.result_ev_decimal },
    isInRecommendationBasket: m.is_in_recommendation_basket,
    weightPct: m.weight_pct,
  };
}

// =============================================================================================
// 1. Cases + Variants (DEC-FIN-005 point 1)
// =============================================================================================

router.post(
  '/valuation/cases',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const body = req.body ?? {};
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return sendError(res, 400, 'INVALID_BODY', 'name is required');
    }
    const row = await createCase({ organizationId, name: body.name, description: typeof body.description === 'string' ? body.description : null, createdBy: userId });
    return res.status(201).json({ data: { caseId: row.case_id, name: row.name, description: row.description, createdBy: row.created_by, createdAt: row.created_at }, meta: financeV2Meta() });
  })
);

router.get(
  '/valuation/cases',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const rows = await listCases(organizationId);
    return res.status(200).json({ data: rows.map((r) => ({ caseId: r.case_id, name: r.name, description: r.description, createdBy: r.created_by, createdAt: r.created_at, archivedAt: r.archived_at })), meta: financeV2Meta() });
  })
);

router.get(
  '/valuation/cases/:caseId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const caseId = String(req.params.caseId || '');
    const kase = await getCase(organizationId, caseId);
    if (!kase) return sendError(res, 404, 'NOT_FOUND', 'Case not found');
    const variants = await listVariants(organizationId, caseId);
    return res.status(200).json({
      data: {
        caseId: kase.case_id,
        name: kase.name,
        description: kase.description,
        createdBy: kase.created_by,
        createdAt: kase.created_at,
        archivedAt: kase.archived_at,
        variants: variants.map((v) => ({ businessVersionId: v.business_version_id, name: v.name, description: v.description, status: v.status, freshness: v.freshness, versionNo: v.version_no, createdBy: v.created_by, createdAt: v.created_at })),
      },
      meta: financeV2Meta(),
    });
  })
);

router.post(
  '/valuation/cases/:caseId/variants',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const caseId = String(req.params.caseId || '');
    const body = req.body ?? {};
    if (typeof body.businessVersionId !== 'string' || !body.businessVersionId.trim()) {
      return sendError(res, 400, 'INVALID_BODY', 'businessVersionId is required (create it first via POST /artifacts with artifactType=VALUATION_CASE)');
    }
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return sendError(res, 400, 'INVALID_BODY', 'name is required');
    }
    const result = await createVariant({
      organizationId,
      caseId,
      businessVersionId: body.businessVersionId,
      name: body.name,
      description: typeof body.description === 'string' ? body.description : null,
      createdBy: userId,
    });
    if (!result.ok) {
      const status = result.code === 'ALREADY_A_VARIANT' ? 409 : 404;
      return sendError(res, status, result.code, result.message);
    }
    const v = result.variant;
    return res.status(201).json({
      data: { businessVersionId: v.business_version_id, caseId: v.case_id, name: v.name, description: v.description, status: v.status, freshness: v.freshness, versionNo: v.version_no, createdBy: v.created_by, createdAt: v.created_at },
      meta: financeV2Meta(),
    });
  })
);

router.get(
  '/valuation/variants/:businessVersionId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');
    const v = await getVariant(organizationId, businessVersionId);
    if (!v) return sendError(res, 404, 'NOT_FOUND', 'Variant not found');
    return res.status(200).json({
      data: { businessVersionId: v.business_version_id, caseId: v.case_id, name: v.name, description: v.description, status: v.status, freshness: v.freshness, versionNo: v.version_no, createdBy: v.created_by, createdAt: v.created_at },
      meta: financeV2Meta(),
    });
  })
);

router.patch(
  '/valuation/variants/:businessVersionId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');
    const body = req.body ?? {};
    if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) {
      return sendError(res, 400, 'INVALID_BODY', 'name, when provided, must be a non-empty string');
    }
    if (body.description !== undefined && body.description !== null && typeof body.description !== 'string') {
      return sendError(res, 400, 'INVALID_BODY', 'description, when provided, must be a string or null');
    }
    const result = await renameVariant({ organizationId, businessVersionId, name: body.name, description: body.description });
    if (!result.ok) return sendError(res, 404, result.code, result.message);
    const v = result.variant;
    return res.status(200).json({
      data: { businessVersionId: v.business_version_id, caseId: v.case_id, name: v.name, description: v.description, status: v.status, freshness: v.freshness, versionNo: v.version_no },
      meta: financeV2Meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// POST /valuation/cases/:caseId/compare-variants — DEC-FIN-005 point 1 "porównanie wariantów" AND
// DEC-FIN-006 point 5 "porównanie wariantów" (Advisor) are the SAME function
// (`compareVariantsForAdvisor`): a structural EV/Equity/WACC/terminal-share/terminal-g diff plus the
// comparison findings those differences justify. `persist:false` (default) is a pure read — nothing
// written, matching priority-1's plain "compare variants" need; `persist:true` additionally writes
// the findings against variant A pre-approval (DEC-FIN-006's "Advisor... porównanie wariantów"),
// same endpoint, one extra flag, per the task's own point 5 wording that compare is a base function
// of a Case, not an Advisor-only feature.
// ---------------------------------------------------------------------------

router.post(
  '/valuation/cases/:caseId/compare-variants',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const caseId = String(req.params.caseId || '');
    const body = req.body ?? {};
    if (typeof body.variantIdA !== 'string' || typeof body.variantIdB !== 'string') {
      return sendError(res, 400, 'INVALID_BODY', 'variantIdA and variantIdB are required strings');
    }
    const params: CompareVariantsParams = {
      caseId,
      variantIdA: body.variantIdA,
      variantIdB: body.variantIdB,
      actorId: userId,
      organizationId,
      persist: body.persist === true,
    };
    const result = await compareVariantsForAdvisor(params);
    if (!result.ok) {
      const status = result.code === 'SAME_VARIANT' ? 400 : result.code === 'INVALID_STATUS' ? 409 : result.code === 'SNAPSHOT_FAILED' ? 500 : 404; // CASE_NOT_FOUND / VARIANT_NOT_IN_CASE / ORGANIZATION_MISMATCH -> 404, fail-closed
      return sendError(res, status, result.code, result.message);
    }
    return res.status(200).json({
      data: {
        caseId: result.caseId,
        variantA: { businessVersionId: result.variantA.businessVersionId, name: result.variantA.name, enterpriseValue: result.variantA.enterpriseValue },
        variantB: { businessVersionId: result.variantB.businessVersionId, name: result.variantB.name, enterpriseValue: result.variantB.enterpriseValue },
        metrics: result.metrics,
        findings: result.findings,
        computeSnapshotId: result.computeSnapshotId,
      },
      meta: financeV2Meta(),
    });
  })
);

// =============================================================================================
// 2. Methods + weighted recommendation basket (DEC-FIN-005 point 2)
// =============================================================================================

router.get(
  '/valuation/variants/:businessVersionId/methods',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');
    const variant = await getVariant(organizationId, businessVersionId);
    if (!variant) return sendError(res, 404, 'NOT_FOUND', 'Variant not found');
    const methods = await listMethods(organizationId, businessVersionId);
    return res.status(200).json({ data: { methods: methods.map(mapMethod), weightedRecommendation: computeWeightedRecommendation(methods) }, meta: financeV2Meta() });
  })
);

router.post(
  '/valuation/variants/:businessVersionId/methods',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');
    const body = req.body ?? {};
    if (!(VALID_METHOD_TYPES as readonly string[]).includes(body.methodType)) {
      return sendError(res, 400, 'INVALID_BODY', `methodType must be one of ${VALID_METHOD_TYPES.join(', ')}`);
    }
    if (body.methodType === 'OTHER_WITH_POLICY' && (typeof body.applicabilityPolicyRef !== 'string' || !body.applicabilityPolicyRef.trim())) {
      return sendError(res, 400, 'INVALID_BODY', 'applicabilityPolicyRef is required for methodType=OTHER_WITH_POLICY');
    }
    const variant = await getVariant(organizationId, businessVersionId);
    if (!variant) return sendError(res, 404, 'NOT_FOUND', 'Variant not found');

    const result = await findOrCreateMethod({
      organizationId,
      businessVersionId,
      methodType: body.methodType,
      createdBy: userId,
      applicabilityPolicyRef: typeof body.applicabilityPolicyRef === 'string' ? body.applicabilityPolicyRef : null,
    });
    if (!result.ok) return sendError(res, 404, result.code, result.message);
    return res.status(201).json({ data: mapMethod(result.method), meta: financeV2Meta() });
  })
);

// ---------------------------------------------------------------------------
// POST /valuation/variants/:businessVersionId/methods/basket — atomic batch weight-set.
// DEC-FIN-005 point 2: "tylko metody aktywne i kompletne dostają wagi, które sumują się do 100%" —
// the DB's own DEFERRABLE constraint trigger (`trg_finance_valuation_methods_weight_sum`) is the
// authoritative enforcement point; a sum != 100 across the FINAL state of every basket member for
// this variant raises at COMMIT and is mapped to 409 below (see `setBasketWeights()`'s own doc
// comment for why this must be ONE batch call, not N one-method PATCHes).
// ---------------------------------------------------------------------------

router.post(
  '/valuation/variants/:businessVersionId/methods/basket',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');
    const body = req.body ?? {};
    if (!Array.isArray(body.updates) || body.updates.length === 0) {
      return sendError(res, 400, 'INVALID_BODY', 'updates must be a non-empty array');
    }
    const updates: { methodId: string; isInRecommendationBasket: boolean; weightPct: number | null }[] = [];
    for (let i = 0; i < body.updates.length; i++) {
      const u = body.updates[i];
      if (typeof u?.methodId !== 'string' || typeof u?.isInRecommendationBasket !== 'boolean') {
        return sendError(res, 400, 'INVALID_BODY', `updates[${i}] requires methodId (string) and isInRecommendationBasket (boolean)`);
      }
      // Mirrors chk_finance_methods_weight_basket_only (WP-D09b): a basket member MUST carry a
      // weight, a cross-check (not in the basket) MUST NOT — physically NULL, never 0 — so a
      // "cross-check with a weight" or "basket member with no weight" is rejected here, before the
      // DB CHECK would also reject it (same friendly-error-first discipline as
      // `assertResultReadinessConsistency`).
      if (u.isInRecommendationBasket) {
        if (typeof u.weightPct !== 'number' || !Number.isFinite(u.weightPct) || u.weightPct <= 0) {
          return sendError(res, 400, 'INVALID_BODY', `updates[${i}]: weightPct must be a positive number when isInRecommendationBasket=true`);
        }
      } else if (u.weightPct !== null && u.weightPct !== undefined) {
        return sendError(res, 400, 'INVALID_BODY', `updates[${i}]: weightPct must be null/omitted when isInRecommendationBasket=false (cross-checks are never weighted, DEC-FIN-005)`);
      }
      updates.push({ methodId: u.methodId, isInRecommendationBasket: u.isInRecommendationBasket, weightPct: u.isInRecommendationBasket ? u.weightPct : null });
    }

    const variant = await getVariant(organizationId, businessVersionId);
    if (!variant) return sendError(res, 404, 'NOT_FOUND', 'Variant not found');

    try {
      const result = await setBasketWeights({ organizationId, businessVersionId, updates });
      if (!result.ok) return sendError(res, 404, result.code, result.message);
      return res.status(200).json({ data: { methods: result.methods.map(mapMethod), weightedRecommendation: computeWeightedRecommendation(result.methods) }, meta: financeV2Meta() });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (/basket weights for business_version/.test(message)) {
        return sendError(res, 409, 'BASKET_WEIGHT_SUM_INVALID', message);
      }
      throw err;
    }
  })
);

// =============================================================================================
// 3. WACC inputs
// =============================================================================================

router.get(
  '/valuation/variants/:businessVersionId/wacc-inputs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');
    const variant = await getVariant(organizationId, businessVersionId);
    if (!variant) return sendError(res, 404, 'NOT_FOUND', 'Variant not found');
    const wacc = await loadWaccInputs(organizationId, businessVersionId);
    if (!wacc) return sendError(res, 404, 'NOT_FOUND', 'No WACC inputs recorded for this variant yet');
    return res.status(200).json({ data: wacc, meta: financeV2Meta() });
  })
);

router.put(
  '/valuation/variants/:businessVersionId/wacc-inputs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');
    const body = req.body ?? {};
    if (typeof body.currency !== 'string' || !body.currency.trim()) {
      return sendError(res, 400, 'INVALID_BODY', 'currency is required');
    }
    if (body.nominalOrReal !== 'NOMINAL' && body.nominalOrReal !== 'REAL') {
      return sendError(res, 400, 'INVALID_BODY', "nominalOrReal must be 'NOMINAL' or 'REAL'");
    }
    if (body.preOrPostTax !== 'PRE_TAX' && body.preOrPostTax !== 'POST_TAX') {
      return sendError(res, 400, 'INVALID_BODY', "preOrPostTax must be 'PRE_TAX' or 'POST_TAX'");
    }
    const variant = await getVariant(organizationId, businessVersionId);
    if (!variant) return sendError(res, 404, 'NOT_FOUND', 'Variant not found');

    const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const params: UpsertWaccInputsParams = {
      organizationId,
      businessVersionId,
      createdBy: userId,
      riskFreeRatePct: num(body.riskFreeRatePct),
      equityRiskPremiumPct: num(body.equityRiskPremiumPct),
      betaPeerSetRef: body.betaPeerSetRef,
      betaUnlevered: num(body.betaUnlevered),
      targetCapitalStructureDebtPct: num(body.targetCapitalStructureDebtPct),
      targetCapitalStructureEquityPct: num(body.targetCapitalStructureEquityPct),
      currentCapitalStructureDebtPct: num(body.currentCapitalStructureDebtPct),
      currentCapitalStructureEquityPct: num(body.currentCapitalStructureEquityPct),
      costOfDebtPretaxPct: num(body.costOfDebtPretaxPct),
      creditSpreadPct: num(body.creditSpreadPct),
      cashTaxRatePct: num(body.cashTaxRatePct),
      currency: body.currency,
      nominalOrReal: body.nominalOrReal,
      preOrPostTax: body.preOrPostTax,
    };
    try {
      const result = await upsertWaccInputs(params);
      if (!result.ok) return sendError(res, 404, result.code, result.message);
      return res.status(200).json({ data: result.wacc, meta: financeV2Meta() });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (/chk_finance_wacc_(target|current)_structure_sum/.test(message)) {
        return sendError(res, 400, 'CAPITAL_STRUCTURE_SUM_INVALID', message);
      }
      throw err;
    }
  })
);

// =============================================================================================
// 4. Compute (DCF/FCFF) + full results (EV, Equity, WACC, terminal, bridge, weighted range)
// =============================================================================================

function statusForDcfError(code: string): number {
  if (code === 'BUSINESS_VERSION_NOT_FOUND' || code === 'NO_VALUATION_SOURCE_EDGE' || code === 'UNKNOWN_CANONICAL_LINE' || code === 'NO_WACC_INPUTS') return 404;
  if (code === 'MULTIPLE_VALUATION_SOURCE_EDGES' || code === 'JOB_NOT_RUNNING') return 409;
  return 422; // INCONSISTENT_CURRENCY / WACC_COMPUTE_FAILED / FCFF_NOT_FULLY_PRESENT / TERMINAL_G_MUST_BE_LESS_THAN_WACC
}

router.post(
  '/valuation/variants/:businessVersionId/compute/dcf',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');
    const body = req.body ?? {};

    const variant = await getVariant(organizationId, businessVersionId);
    if (!variant) return sendError(res, 404, 'NOT_FOUND', 'Variant not found');

    if (typeof body.entityId !== 'string' || !body.entityId.trim()) {
      return sendError(res, 400, 'INVALID_BODY', 'entityId is required');
    }
    if (!Array.isArray(body.projectionYears) || body.projectionYears.length === 0) {
      return sendError(res, 400, 'INVALID_BODY', 'projectionYears must be a non-empty array of {fiscalYear, periodIds[]}');
    }
    for (let i = 0; i < body.projectionYears.length; i++) {
      const y = body.projectionYears[i];
      if (typeof y?.fiscalYear !== 'number' || !Array.isArray(y?.periodIds) || y.periodIds.some((p: unknown) => typeof p !== 'string')) {
        return sendError(res, 400, 'INVALID_BODY', `projectionYears[${i}] requires fiscalYear (number) and periodIds (array of strings)`);
      }
    }
    if (!body.terminal || typeof body.terminal !== 'object') {
      return sendError(res, 400, 'INVALID_BODY', 'terminal input is required');
    }

    const bv = await getBusinessVersion(organizationId, businessVersionId);
    if (!bv) return sendError(res, 404, 'NOT_FOUND', 'Business version not found');

    const params: RunDcfFcffValuationParams = {
      organizationId,
      valuationBusinessVersionId: businessVersionId,
      entityId: body.entityId,
      requestedByUserId: userId,
      engineManifestId: typeof body.engineManifestId === 'string' ? body.engineManifestId : bv.engine_manifest_id,
      requestId: typeof body.requestId === 'string' ? body.requestId : null,
      projectionYears: body.projectionYears,
      openingWorkingCapital: typeof body.openingWorkingCapital === 'number' ? body.openingWorkingCapital : null,
      terminal: {
        gPct: typeof body.terminal.gPct === 'number' ? body.terminal.gPct : undefined,
      },
      directCashTaxRatePct: typeof body.directCashTaxRatePct === 'number' ? body.directCashTaxRatePct : undefined,
      valuationAsOfDate: typeof body.valuationAsOfDate === 'string' ? body.valuationAsOfDate : undefined,
    };

    const result = await runDcfFcffValuation(params);
    if (!result.ok) {
      return sendError(res, statusForDcfError(result.code), result.code, result.message);
    }
    return res.status(200).json({
      data: {
        jobId: result.job.id,
        jobStatus: result.job.status,
        methodId: result.methodId,
        enterpriseValue: result.enterpriseValue,
        equityValue: result.equityValue,
        wacc: result.wacc,
        terminalValue: result.terminalValue,
        discounted: result.discounted,
        fcffYears: result.fcffYears,
      },
      meta: financeV2Meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /valuation/variants/:businessVersionId/results — DEC-FIN-005 point 3: EV, Equity Value,
// recommended (weighted) range, per-method result + contribution, terminal share, WACC, full
// EV→Equity bridge, plus method-agreement (dispersion) warnings. Every number carries its own
// source table implicitly through this endpoint's shape (methods/wacc/terminal/bridge are each a
// distinct sub-object naming their own table's columns) — composed the same way Pakiet B2's report
// §5 documents for Statements (freshness/compute lineage live at the variant level via
// `GET /versions/:id` + `GET /versions/:id/lineage`, not duplicated per-cell here).
// ---------------------------------------------------------------------------

router.get(
  '/valuation/variants/:businessVersionId/results',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');
    const snap = await loadValuationSnapshot(organizationId, businessVersionId);
    if (!snap.ok) return sendError(res, 404, snap.code, snap.message);
    const snapshot = snap.snapshot;

    const headline = resolveHeadlineEnterpriseValue(snapshot);
    const weighted = computeWeightedRecommendation(snapshot.methods);
    const findings = evaluateAdvisorRules(snapshot);
    const methodAgreementWarnings = findings
      .filter((f) => f.driverRef === 'METHOD_DISPERSION')
      .map((f) => ({ ruleId: f.ruleId, kind: f.outputKind, title: f.title, narrative: f.narrative, confidence: f.confidence }));

    return res.status(200).json({
      data: {
        businessVersionId,
        variant: snapshot.variant,
        status: snapshot.status,
        freshness: snapshot.freshness,
        headlineEnterpriseValue: headline,
        weightedRecommendation: weighted,
        methods: snapshot.methods.map(mapMethod),
        wacc: snapshot.wacc,
        terminal: snapshot.terminal,
        bridge: snapshot.bridge,
        sensitivityGrids: snapshot.grids,
        usableCompsByMethodId: snapshot.usableCompsByMethodId,
        // DEC-FIN-005 point 2 "ostrzeżenia o korelacji metod (pseudodywersyfikacja)": no dedicated
        // pairwise-correlation coefficient exists anywhere in this codebase (grep-verified) — this
        // surfaces the closest real signal that DOES exist, `evaluateAdvisorRules`'s method
        // dispersion/agreement finding (ADV-R11/R12), labeled honestly as that rather than claiming
        // a correlation metric this package did not build.
        methodAgreementWarnings,
      },
      meta: financeV2Meta(),
    });
  })
);

// =============================================================================================
// 5. EV -> Equity bridge (DEC-FIN-005 point 3, "pełny most EV→Equity")
// =============================================================================================

router.get(
  '/valuation/variants/:businessVersionId/bridge',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');
    const variant = await getVariant(organizationId, businessVersionId);
    if (!variant) return sendError(res, 404, 'NOT_FOUND', 'Variant not found');
    const bridge = await getBridge(organizationId, businessVersionId);
    if (!bridge) return sendError(res, 404, 'NOT_FOUND', 'No EV->Equity bridge recorded for this variant yet');
    return res.status(200).json({ data: bridge, meta: financeV2Meta() });
  })
);

router.put(
  '/valuation/variants/:businessVersionId/bridge',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');
    const body = req.body ?? {};

    const variant = await getVariant(organizationId, businessVersionId);
    if (!variant) return sendError(res, 404, 'NOT_FOUND', 'Variant not found');

    if (typeof body.asOfDate !== 'string' || typeof body.enterpriseValueDecimal !== 'number' || !Array.isArray(body.components)) {
      return sendError(res, 400, 'INVALID_BODY', 'asOfDate (string), enterpriseValueDecimal (number) and components (array) are required');
    }
    const components: BridgeComponentInput[] = [];
    for (let i = 0; i < body.components.length; i++) {
      const c = body.components[i];
      if (
        typeof c?.sequenceOrder !== 'number' ||
        !(VALID_BRIDGE_KINDS as readonly string[]).includes(c?.componentKind) ||
        !(VALID_BRIDGE_SIGNS as readonly string[]).includes(c?.sign) ||
        typeof c?.amountDecimal !== 'number' ||
        typeof c?.asOfDate !== 'string'
      ) {
        return sendError(res, 400, 'INVALID_BODY', `components[${i}] requires sequenceOrder (number), componentKind, sign, amountDecimal (number) and asOfDate (string)`);
      }
      components.push({
        sequenceOrder: c.sequenceOrder,
        componentKind: c.componentKind,
        sign: c.sign,
        amountDecimal: c.amountDecimal,
        asOfDate: c.asOfDate,
        rationale: typeof c.rationale === 'string' ? c.rationale : null,
      });
    }

    const equity = computeEquityValue(body.enterpriseValueDecimal, components);
    if (!equity.ok) return sendError(res, 400, equity.code, equity.message);

    const writeParams: WriteBridgeParams = {
      organizationId,
      businessVersionId,
      asOfDate: body.asOfDate,
      enterpriseValueDecimal: body.enterpriseValueDecimal,
      equityValueDecimal: equity.equityValueDecimal,
      components,
      createdBy: userId,
    };
    const written = await writeBridge(writeParams);
    if (!written.ok) return sendError(res, 400, written.code, written.message);

    return res.status(200).json({
      data: { bridgeId: written.bridgeId, enterpriseValueDecimal: body.enterpriseValueDecimal, equityValueDecimal: equity.equityValueDecimal, breakdown: equity.breakdown },
      meta: financeV2Meta(),
    });
  })
);

// =============================================================================================
// 6. Terminal value (read) + Sensitivity 5x5 (DEC-FIN-005 point 4) — method-scoped
// =============================================================================================

router.get(
  '/valuation/methods/:methodId/terminal',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const methodId = String(req.params.methodId || '');
    const method = await getMethod(organizationId, methodId);
    if (!method) return sendError(res, 404, 'NOT_FOUND', 'Method not found');
    const rows = await listTerminalRows(organizationId, methodId);
    return res.status(200).json({ data: rows, meta: financeV2Meta() });
  })
);

router.post(
  '/valuation/methods/:methodId/sensitivity',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const methodId = String(req.params.methodId || '');
    const body = req.body ?? {};

    const method = await getMethod(organizationId, methodId);
    if (!method) return sendError(res, 404, 'NOT_FOUND', 'Method not found');

    if (typeof body.gridLabel !== 'string' || !body.gridLabel.trim()) {
      return sendError(res, 400, 'INVALID_BODY', 'gridLabel is required');
    }
    if (typeof body.rowAxisVariable !== 'string' || typeof body.columnAxisVariable !== 'string') {
      return sendError(res, 400, 'INVALID_BODY', 'rowAxisVariable and columnAxisVariable are required strings');
    }
    const wacc = body.axes?.wacc;
    const terminalG = body.axes?.terminalG;
    if (!Array.isArray(wacc) || wacc.length !== 5 || wacc.some((n: unknown) => typeof n !== 'number')) {
      return sendError(res, 400, 'INVALID_BODY', 'axes.wacc must be an array of exactly 5 numbers');
    }
    if (!Array.isArray(terminalG) || terminalG.length !== 5 || terminalG.some((n: unknown) => typeof n !== 'number')) {
      return sendError(res, 400, 'INVALID_BODY', 'axes.terminalG must be an array of exactly 5 numbers');
    }
    if (!Array.isArray(body.years) || body.years.length === 0 || body.years.some((y: unknown) => typeof (y as { fcff?: unknown })?.fcff !== 'number' || typeof (y as { fiscalYear?: unknown })?.fiscalYear !== 'number')) {
      return sendError(res, 400, 'INVALID_BODY', 'years must be a non-empty array of {fiscalYear, fcff}');
    }
    if (typeof body.fcffTerminalYear !== 'number' || typeof body.baseWaccPct !== 'number' || typeof body.baseGPct !== 'number') {
      return sendError(res, 400, 'INVALID_BODY', 'fcffTerminalYear, baseWaccPct and baseGPct (numbers) are required');
    }

    const axes: SensitivityAxisValues = { wacc: wacc as [number, number, number, number, number], terminalG: terminalG as [number, number, number, number, number] };
    const built = buildWaccByTerminalGGrid({
      axes,
      years: body.years,
      fcffTerminalYear: body.fcffTerminalYear,
      baseWaccPct: body.baseWaccPct,
      baseGPct: body.baseGPct,
    });
    if (!built.ok) return sendError(res, 400, built.code, built.message);

    const written = await writeSensitivityGrid({
      organizationId,
      methodId,
      gridLabel: body.gridLabel,
      rowAxisVariable: body.rowAxisVariable,
      columnAxisVariable: body.columnAxisVariable,
      cells: built.cells,
      createdBy: userId,
    });

    return res.status(200).json({
      data: { gridId: written.gridId, gridLabel: body.gridLabel, gridStatus: 'COMPLETE', baseRowIndex: built.baseRowIndex, baseColIndex: built.baseColIndex, cells: built.cells },
      meta: financeV2Meta(),
    });
  })
);

router.get(
  '/valuation/methods/:methodId/sensitivity/:gridLabel',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const methodId = String(req.params.methodId || '');
    const gridLabel = String(req.params.gridLabel || '');
    const method = await getMethod(organizationId, methodId);
    if (!method) return sendError(res, 404, 'NOT_FOUND', 'Method not found');
    const grid = await getSensitivityGrid(organizationId, methodId, gridLabel);
    if (!grid) return sendError(res, 404, 'NOT_FOUND', 'Sensitivity grid not found');
    return res.status(200).json({ data: grid, meta: financeV2Meta() });
  })
);

// =============================================================================================
// 7. Advisor (DEC-FIN-006) — pre-approval only, freshly-computed-candidate only, versioned,
//    survives approval (frozen), changes no data.
// =============================================================================================

function statusForAdvisorError(code: string): number {
  if (code === 'VARIANT_NOT_FOUND' || code === 'ORGANIZATION_MISMATCH') return 404;
  if (code === 'NOT_A_VALUATION_CASE') return 400;
  if (code === 'INVALID_STATUS' || code === 'NOTHING_COMPUTED') return 409;
  return 500; // SNAPSHOT_FAILED
}

router.post(
  '/valuation/variants/:businessVersionId/advisor/generate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');
    const body = req.body ?? {};

    const params: GenerateValuationAdvisorOutputParams = {
      variantId: businessVersionId,
      actorId: userId,
      organizationId,
      persist: body.persist !== false,
    };
    const result = await generateValuationAdvisorOutput(params);
    if (!result.ok) return sendError(res, statusForAdvisorError(result.code), result.code, result.message, result.currentStatus ? { currentStatus: result.currentStatus } : undefined);
    return res.status(200).json({
      data: { variantId: result.variantId, computeSnapshotId: result.computeSnapshotId, findings: result.findings, countsByKind: result.countsByKind },
      meta: financeV2Meta(),
    });
  })
);

router.get(
  '/valuation/variants/:businessVersionId/advisor',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');
    const variant = await getVariant(organizationId, businessVersionId);
    if (!variant) return sendError(res, 404, 'NOT_FOUND', 'Variant not found');
    const rows = await listAdvisorOutputs(organizationId, businessVersionId);
    return res.status(200).json({ data: rows, meta: financeV2Meta() });
  })
);

export default router;
