/**
 * Case Workspace HTTP routes — executionGraphService
 * (server/src/services/caseWorkspace/executionGraphService.ts).
 *
 * Mounted at /api/v8/case-workspace (see caseWorkspace/index.ts).
 *
 * Neither recordGatewayEvaluation/recordNodeResultAcceptance nor their
 * getters take a caseId directly — only a runId (resolved internally to
 * case_workspace_run_bindings) or a nodeRunId. This route file resolves the
 * owning caseId via runBindingService.getRunBinding(runId) before any
 * runId-scoped mutation/list, and via the row's own `caseId` (already
 * returned on CaseGatewayEvaluation/CaseNodeResultAcceptance) for by-id
 * reads, so tenant access is verified before touching the service.
 *
 * RE-WIRE AFTER STREAM A MERGES: recordGatewayEvaluation/
 * recordNodeResultAcceptance take `recordedByActorId` directly inside their
 * own input object (no separate `actor` wrapper) — forced to
 * `actor.actorUserId` below; no structural change expected.
 */

import { Router } from 'express';
import { z } from 'zod';

import * as svc from '../../services/caseWorkspace/executionGraphService.js';
import * as runBindingSvc from '../../services/caseWorkspace/runBindingService.js';
import { requireCaseAccessForActor } from './_shared/access.js';
import { caseWorkspaceHandler } from './_shared/handler.js';
import { toCaseWorkspaceAppError } from './_shared/errors.js';
import { parseBody, parseParams, parseQuery } from './_shared/validate.js';
import type { CaseWorkspaceActor } from './_shared/handler.js';

const router = Router();

const gatewayNodeTypeEnum = z.enum(['DECISION_GATEWAY', 'PARALLEL_SPLIT', 'PARALLEL_JOIN']);
const joinPolicyEnum = z.enum(['ALL', 'ANY', 'N_OF_M']);
const outcomeStatusEnum = z.enum([
  'BRANCH_SELECTED',
  'SPLIT_ACTIVATED',
  'JOIN_SATISFIED',
  'JOIN_PENDING',
  'JOIN_UNSATISFIED',
]);
const nodeTypeEnum = z.enum([
  'START',
  'END',
  'CAPABILITY',
  'HUMAN_TASK',
  'APPROVAL',
  'TIMER_WAIT',
  'EVENT_WAIT',
  'DECISION_GATEWAY',
  'PARALLEL_SPLIT',
  'PARALLEL_JOIN',
  'SUBFLOW',
  'ANNOTATION',
]);
const completionStateEnum = z.enum(['COMPLETED', 'SKIPPED']);
const resultAcceptanceEnum = z.enum(['ACCEPTED', 'PARTIAL', 'REJECTED', 'NOT_APPLICABLE']);

const runIdParams = z.object({ runId: z.string().trim().min(1) });
const caseIdParams = z.object({ caseId: z.string().trim().min(1) });
const nodeRunIdParams = z.object({ nodeRunId: z.string().trim().min(1) });

async function requireCaseAccessForRun(actor: CaseWorkspaceActor, runId: string): Promise<string> {
  const binding = await runBindingSvc.getRunBinding(runId, actor.actorUserId);
  if (!binding) {
    throw toCaseWorkspaceAppError(new Error('run_binding_not_found'), actor.correlationId);
  }
  await requireCaseAccessForActor(actor, binding.caseId);
  return binding.caseId;
}

// POST /runs/:runId/gateway-evaluations — recordGatewayEvaluation
const recordGatewayBody = z.object({
  nodeRunId: z.string().trim().min(1),
  gatewayNodeType: gatewayNodeTypeEnum,
  joinPolicy: joinPolicyEnum.nullable().optional(),
  joinRequiredCount: z.number().int().nullable().optional(),
  joinBranchTotalCount: z.number().int().nullable().optional(),
  conditionExpression: z.string().trim().min(1).nullable().optional(),
  conditionSchemaVersion: z.string().trim().min(1).nullable().optional(),
  evaluationInputSnapshot: z.unknown(),
  outcomeStatus: outcomeStatusEnum,
  outcomeDetail: z.unknown().optional(),
  evaluatedAt: z.string().trim().min(1),
});

router.post(
  '/runs/:runId/gateway-evaluations',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(runIdParams, req.params);
    const body = parseBody(recordGatewayBody, req.body);
    await requireCaseAccessForRun(actor, params.runId);
    const created = await svc.recordGatewayEvaluation({
      ...body,
      runId: params.runId,
      recordedByActorId: actor.actorUserId,
    });
    res.status(201).json({ data: created });
  })
);

// GET /gateway-evaluations/:nodeRunId
router.get(
  '/gateway-evaluations/:nodeRunId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(nodeRunIdParams, req.params);
    const found = await svc.getGatewayEvaluation(params.nodeRunId, actor.actorUserId);
    if (!found) {
      throw toCaseWorkspaceAppError(new Error('gateway_evaluation_not_found'), actor.correlationId);
    }
    await requireCaseAccessForActor(actor, found.caseId);
    res.status(200).json({ data: found });
  })
);

// GET /runs/:runId/gateway-evaluations — listGatewayEvaluationsForRun
router.get(
  '/runs/:runId/gateway-evaluations',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(runIdParams, req.params);
    await requireCaseAccessForRun(actor, params.runId);
    const items = await svc.listGatewayEvaluationsForRun(params.runId, actor.actorUserId);
    res.status(200).json({ data: items });
  })
);

// GET /cases/:caseId/gateway-evaluations — listGatewayEvaluationsForCase
router.get(
  '/cases/:caseId/gateway-evaluations',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(caseIdParams, req.params);
    await requireCaseAccessForActor(actor, params.caseId);
    const items = await svc.listGatewayEvaluationsForCase(params.caseId, actor.actorUserId);
    res.status(200).json({ data: items });
  })
);

// POST /runs/:runId/node-result-acceptances — recordNodeResultAcceptance
const recordAcceptanceBody = z.object({
  nodeRunId: z.string().trim().min(1),
  nodeType: nodeTypeEnum,
  nodeCompletionState: completionStateEnum,
  resultAcceptance: resultAcceptanceEnum,
  skipAuthorizedByGraphCondition: z.boolean().nullable().optional(),
  skipConditionRef: z.string().trim().min(1).nullable().optional(),
  causedByGatewayNodeRunId: z.string().trim().min(1).nullable().optional(),
  acceptanceInputSnapshot: z.unknown(),
  occurredAt: z.string().trim().min(1),
});

router.post(
  '/runs/:runId/node-result-acceptances',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(runIdParams, req.params);
    const body = parseBody(recordAcceptanceBody, req.body);
    await requireCaseAccessForRun(actor, params.runId);
    const created = await svc.recordNodeResultAcceptance({
      ...body,
      runId: params.runId,
      recordedByActorId: actor.actorUserId,
    });
    res.status(201).json({ data: created });
  })
);

// GET /node-result-acceptances/:nodeRunId
router.get(
  '/node-result-acceptances/:nodeRunId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(nodeRunIdParams, req.params);
    const found = await svc.getNodeResultAcceptance(params.nodeRunId, actor.actorUserId);
    if (!found) {
      throw toCaseWorkspaceAppError(new Error('node_result_acceptance_not_found'), actor.correlationId);
    }
    await requireCaseAccessForActor(actor, found.caseId);
    res.status(200).json({ data: found });
  })
);

// GET /runs/:runId/node-result-acceptances — listNodeResultAcceptancesForRun
router.get(
  '/runs/:runId/node-result-acceptances',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(runIdParams, req.params);
    const query = parseQuery(z.object({ resultAcceptance: resultAcceptanceEnum.optional() }), req.query);
    await requireCaseAccessForRun(actor, params.runId);
    const items = await svc.listNodeResultAcceptancesForRun(params.runId, query, actor.actorUserId);
    res.status(200).json({ data: items });
  })
);

// GET /cases/:caseId/node-result-acceptances — listNodeResultAcceptancesForCase
router.get(
  '/cases/:caseId/node-result-acceptances',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(caseIdParams, req.params);
    await requireCaseAccessForActor(actor, params.caseId);
    const items = await svc.listNodeResultAcceptancesForCase(params.caseId, actor.actorUserId);
    res.status(200).json({ data: items });
  })
);

export default router;
