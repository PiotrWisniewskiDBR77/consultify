/**
 * Interview Transcript Service (T013)
 *
 * Manages conversational transcript messages for interview sessions.
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

export interface TranscriptMessage {
  id: string;
  sessionId: string;
  organizationId: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export async function addMessage(
  organizationId: string,
  sessionId: string,
  role: 'user' | 'ai' | 'system',
  content: string,
  metadata?: Record<string, unknown>
): Promise<TranscriptMessage> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const metaJson = JSON.stringify(metadata || {});

  await dbRun(
    `INSERT INTO interview_transcript_messages (id, session_id, organization_id, role, content, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, sessionId, organizationId, role, content, metaJson, now]
  );

  return {
    id,
    sessionId,
    organizationId,
    role,
    content,
    metadata: metadata || {},
    createdAt: now,
  };
}

export async function getMessages(
  organizationId: string,
  sessionId: string,
  limit = 200
): Promise<TranscriptMessage[]> {
  const rows = await dbAll(
    `SELECT id, session_id, organization_id, role, content, metadata, created_at
     FROM interview_transcript_messages
     WHERE session_id = ? AND organization_id = ?
     ORDER BY created_at ASC
     LIMIT ?`,
    [sessionId, organizationId, limit]
  );

  return (rows || []).map((r: any) => ({
    id: r.id,
    sessionId: r.session_id,
    organizationId: r.organization_id,
    role: r.role,
    content: r.content,
    metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata || '{}') : (r.metadata || {}),
    createdAt: r.created_at,
  }));
}

export async function getMessageCount(
  organizationId: string,
  sessionId: string
): Promise<number> {
  const row = await dbGet(
    `SELECT COUNT(*) as cnt FROM interview_transcript_messages
     WHERE session_id = ? AND organization_id = ?`,
    [sessionId, organizationId]
  );
  return (row as any)?.cnt || 0;
}

export async function deleteMessages(
  organizationId: string,
  sessionId: string
): Promise<void> {
  await dbRun(
    `DELETE FROM interview_transcript_messages
     WHERE session_id = ? AND organization_id = ?`,
    [sessionId, organizationId]
  );
}
