import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import verifyToken, { requireOrganization } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import {
  type AgentRuntimeService,
  agentRuntimeService,
} from '../../services/v10/agent/agentRuntimeService.js';
import {
  AppendRunLedgerSchema,
  EvaluateExecutionProposalSchema,
  PlanApprovalBarrierSchema,
  QueryRunLedgerSchema,
  ResumeApprovalBarrierSchema,
  SubmitInterruptVerbSchema,
  SummarizeRunLedgerSchema,
} from '../../types/v10/agent-runtime.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const V10_AGENT_RUNTIME_CONTRACT = 'agent_runtime_wave_b_v1';

function meta() {
  return {
    version: 'v10' as const,
    contract: V10_AGENT_RUNTIME_CONTRACT,
  };
}

export function createAgentRuntimeRouter(service: AgentRuntimeService = agentRuntimeService) {
  const router = Router();

  router.use(verifyToken);
  router.use(requireOrganization);

  router.post(
    '/proposals/evaluate',
    validateBody(EvaluateExecutionProposalSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const result = await service.evaluateExecutionProposal(req.body);
      return res.status(200).json({ data: result, meta: meta() });
    })
  );

  router.post(
    '/approval-barriers/plan',
    validateBody(PlanApprovalBarrierSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const result = await service.planApprovalBarrier(req.body);
      return res.status(200).json({ data: result, meta: meta() });
    })
  );

  router.post(
    '/approval-barriers/resume',
    validateBody(ResumeApprovalBarrierSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const result = await service.resumeApprovalBarrier(req.body);
      return res.status(200).json({ data: result, meta: meta() });
    })
  );

  router.post(
    '/interrupt-verbs/submit',
    validateBody(SubmitInterruptVerbSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const result = await service.submitInterruptVerb(req.body);
      return res.status(200).json({ data: result, meta: meta() });
    })
  );

  router.post(
    '/run-ledger/append',
    validateBody(AppendRunLedgerSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const result = await service.appendRunLedger(req.body);
      return res.status(201).json({ data: result, meta: meta() });
    })
  );

  router.post(
    '/run-ledger/query',
    validateBody(QueryRunLedgerSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const result = await service.queryRunLedger(req.body);
      return res.status(200).json({ data: result, meta: meta() });
    })
  );

  router.post(
    '/run-ledger/summarize',
    validateBody(SummarizeRunLedgerSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const result = await service.summarizeRunLedger(req.body);
      return res.status(200).json({ data: result, meta: meta() });
    })
  );

  return router;
}

const router = createAgentRuntimeRouter();

export default router;
