import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

let mockUser: any = {
  id: 'user-1',
  role: 'ADMIN',
  organizationId: 'org-1',
};

import { vi } from 'vitest';

vi.mock('../../../../server/src/controllers/ToolController.js', () => ({
  default: {
    createToolSession: (_req: any, res: any) => res.status(200).json({ id: 'tool-1' }),
    listToolSessions: (_req: any, res: any) => res.status(200).json({ sessions: [] }),
    getToolsHub: (_req: any, res: any) => res.status(200).json({}),
    suggestTool: (_req: any, res: any) => res.status(200).json({ suggestions: [] }),
    getToolDoDCheck: (_req: any, res: any) => res.status(200).json({}),
    getRuntimeDoDStatus: (_req: any, res: any) => res.status(200).json({}),
    approveDoDGate: (_req: any, res: any) => res.status(200).json({}),
    getToolSession: (_req: any, res: any) => res.status(200).json({}),
    updateToolSession: (_req: any, res: any) => res.status(200).json({}),
    requestReview: (_req: any, res: any) => res.status(200).json({}),
    approveTool: (_req: any, res: any) => res.status(200).json({}),
    sendBackToDraft: (_req: any, res: any) => res.status(200).json({}),
    promoteToOutput: (_req: any, res: any) => res.status(200).json({}),
    retryFromFailure: (_req: any, res: any) => res.status(200).json({}),
    generateInitiatives: (_req: any, res: any) => res.status(200).json({}),
    getGeneratedInitiatives: (_req: any, res: any) => res.status(200).json({}),
    listComments: (_req: any, res: any) => res.status(200).json({ comments: [] }),
    addComment: (_req: any, res: any) => res.status(201).json({}),
    deleteComment: (_req: any, res: any) => res.status(204).end(),
    getHistory: (_req: any, res: any) => res.status(200).json({ history: [] }),
    handoffSwotCandidate: (_req: any, res: any) => res.status(200).json({}),
    createSwotProposals: (_req: any, res: any) => res.status(201).json({}),
    listSwotProposals: (_req: any, res: any) => res.status(200).json({ proposals: [] }),
    acceptSwotProposal: (_req: any, res: any) => res.status(200).json({}),
    rejectSwotProposal: (_req: any, res: any) => res.status(200).json({}),
  },
}));

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.user = mockUser;
    req.userId = mockUser.id;
    req.organizationId = mockUser.organizationId;
    next();
  },
}));

vi.mock('../../../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/validators/tool.validators.js', () => ({
  CreateToolSessionSchema: {},
  UpdateToolSessionSchema: {},
  RequestReviewSchema: {},
  ApproveToolSchema: {},
  SendBackSchema: {},
  GenerateInitiativesSchema: {},
  SuggestToolSchema: {},
  CreateSwotProposalsSchema: {},
  AcceptSwotProposalSchema: {},
  RejectSwotProposalSchema: {},
}));

vi.mock('../../../../server/src/validators/toolRuntime.validators.js', () => ({
  ApproveDoDGateSchema: {},
}));

describe('tools.routes org guard', () => {
  it('returns 403 RBAC code when org context is missing', async () => {
    mockUser = {
      id: 'user-1',
      role: 'ADMIN',
      organizationId: '',
    };
    const { default: toolsRouter } = await import('../../../../server/src/routes/tools.routes.js');
    const app = express();
    app.use('/tools', toolsRouter);

    const res = await request(app).get('/tools');
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      error: 'Organization access required',
      code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
    });
  });
});
