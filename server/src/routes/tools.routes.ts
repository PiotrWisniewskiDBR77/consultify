/**
 * Tools Routes
 * Tools -> Initiatives workflow endpoints
 */

import { Router } from 'express';

import ToolControllerRaw from '../controllers/ToolController.js';
const ToolController = ToolControllerRaw as any;
import { requireActiveTenantMembership } from '../middleware/auditsStrictMembership.middleware.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../middleware/rbac.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import {
  AcceptSwotProposalSchema,
  ApproveToolSchema,
  CreateSwotProposalsSchema,
  CreateToolSessionSchema,
  GenerateInitiativesSchema,
  HandoffSwotCandidateSchema,
  RejectSwotProposalSchema,
  RequestReviewSchema,
  SendBackSchema,
  SuggestToolSchema,
  UpdateToolSessionSchema,
} from '../validators/tool.validators.js';
import { ApproveDoDGateSchema } from '../validators/toolRuntime.validators.js';

const router = Router();

router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireActiveTenantMembership);
router.use(requireOrgAccess());
router.use(demoContextMiddleware);

router.post('/', validateBody(CreateToolSessionSchema), ToolController.createToolSession);
router.get('/', ToolController.listToolSessions);
/** V4-TOOL-01: Tools hub — sessions + library in one response */
router.get('/hub', ToolController.getToolsHub);
/** #64: AI picker — problem description in, top-3 candidate tools out */
router.post('/suggest', validateBody(SuggestToolSchema), ToolController.suggestTool);
router.get('/:toolId/dod-check', ToolController.getToolDoDCheck);
router.get('/:toolId/dod-status', ToolController.getRuntimeDoDStatus);
router.post(
  '/:toolId/dod-gate/:gateId/approve',
  validateBody(ApproveDoDGateSchema),
  ToolController.approveDoDGate
);
router.get('/:toolId', ToolController.getToolSession);
router.put('/:toolId', validateBody(UpdateToolSessionSchema), ToolController.updateToolSession);
router.post(
  '/:toolId/request-review',
  validateBody(RequestReviewSchema),
  ToolController.requestReview
);
router.post('/:toolId/approve', validateBody(ApproveToolSchema), ToolController.approveTool);
router.post('/:toolId/send-back', validateBody(SendBackSchema), ToolController.sendBackToDraft);
router.post('/:toolId/promote', ToolController.promoteToOutput);
router.post(
  '/:toolId/swot-candidates',
  validateBody(HandoffSwotCandidateSchema),
  ToolController.handoffSwotCandidate
);
router.get('/:toolId/swot-candidates', ToolController.listSwotCandidateReceipts);
router.post('/:toolId/retry', ToolController.retryFromFailure);
router.post(
  '/:toolId/generate-initiatives',
  validateBody(GenerateInitiativesSchema),
  ToolController.generateInitiatives
);
router.get('/:toolId/generated-initiatives', ToolController.getGeneratedInitiatives);
router.get('/:toolId/comments', ToolController.listComments);
router.post('/:toolId/comments', ToolController.addComment);
router.delete('/:toolId/comments/:commentId', ToolController.deleteComment);
router.get('/:toolId/history', ToolController.getHistory);

// TLS-04 — Teresa-assisted SWOT: proposals are a durable, reviewable record
// (diff, sources/assumption, confidence, rationale) that never auto-saves;
// the user explicitly accepts/edits/rejects before anything touches the
// real SWOT data in tool_sessions.answers_json.
router.post(
  '/:toolId/swot-proposals',
  validateBody(CreateSwotProposalsSchema),
  ToolController.createSwotProposals
);
router.get('/:toolId/swot-proposals', ToolController.listSwotProposals);
router.post(
  '/:toolId/swot-proposals/:proposalId/accept',
  validateBody(AcceptSwotProposalSchema),
  ToolController.acceptSwotProposal
);
router.post(
  '/:toolId/swot-proposals/:proposalId/reject',
  validateBody(RejectSwotProposalSchema),
  ToolController.rejectSwotProposal
);

export default router;
