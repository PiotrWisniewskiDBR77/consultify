/**
 * V8 Chat API
 * Domain module for Chat V8 endpoints: snapshots, handoffs, bindings.
 */

import { v8Get, v8Post } from './client';

export const V8ChatApi = {
  getSnapshotsByConversation: (conversationId: string) =>
    v8Get('/chat/snapshots', { conversationId }),

  getSnapshotsByRun: (runId: string) =>
    v8Get('/chat/snapshots', { runId }),

  getSnapshot: (snapshotId: string) =>
    v8Get(`/chat/snapshots/${snapshotId}`),

  captureSnapshot: (params: Record<string, unknown>) =>
    v8Post('/chat/snapshots', params),

  getHandoffs: (conversationId: string) =>
    v8Get('/chat/handoffs', { conversationId }),

  createHandoff: (params: Record<string, unknown>) =>
    v8Post('/chat/handoffs', params),

  captureForChat: (params: Record<string, unknown>) =>
    v8Post('/chat/bindings/chat', params),

  captureForExecution: (params: Record<string, unknown>) =>
    v8Post('/chat/bindings/execution', params),

  captureForRetrieval: (params: Record<string, unknown>) =>
    v8Post('/chat/bindings/retrieval', params),
};
