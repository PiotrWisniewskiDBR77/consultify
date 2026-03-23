/**
 * V8 AI Core API
 * Domain module for AI Core V8 endpoints: environment, chat-turn, trust, tools.
 */

import { v8Get, v8Post } from './client';

export const V8AICoreApi = {
  getEnvironment: () =>
    v8Get('/ai-core/environment'),

  processChatTurn: (params: {
    conversationId: string;
    workspaceId: string;
    message: string;
    [key: string]: unknown;
  }) => v8Post('/ai-core/chat-turn', params),

  getAuditTrail: (snapshotId: string) =>
    v8Get('/ai-core/trust/audit-trail', { snapshotId }),

  getProvenance: (snapshotId: string) =>
    v8Get('/ai-core/trust/provenance', { snapshotId }),

  getTools: () =>
    v8Get('/ai-core/tools'),

  getToolPolicy: (toolId: string, consumerClass?: string) =>
    v8Get(`/ai-core/tools/${toolId}/policy`, consumerClass ? { consumerClass } : undefined),
};
