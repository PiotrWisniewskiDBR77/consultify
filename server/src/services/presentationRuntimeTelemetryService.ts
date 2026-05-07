import { v4 as uuidv4 } from 'uuid';

import { run as dbRun } from '../utils/DbPromise.js';

export interface PresentationRuntimeEventInput {
  organizationId: string;
  deckId?: string | null;
  userId?: string | null;
  eventType: string;
  status?: string | null;
  scope?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function buildPresentationRuntimeEventRecord(event: PresentationRuntimeEventInput) {
  return {
    id: uuidv4().replace(/-/g, ''),
    organizationId: event.organizationId,
    deckId: event.deckId || null,
    userId: event.userId || null,
    eventType: event.eventType,
    status: event.status || null,
    scope: event.scope || null,
    metadataJson: JSON.stringify(event.metadata || {}),
  };
}

export async function writePresentationRuntimeEvent(event: PresentationRuntimeEventInput) {
  const row = buildPresentationRuntimeEventRecord(event);
  await dbRun(
    `INSERT INTO presentation_runtime_events (id, organization_id, deck_id, user_id, event_type, status, scope, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      row.id,
      row.organizationId,
      row.deckId,
      row.userId,
      row.eventType,
      row.status,
      row.scope,
      row.metadataJson,
    ]
  );
}
