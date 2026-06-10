/**
 * Deliverables — telemetria generacji (faza D2 planu wykonawczego; audyt P2-5).
 *
 * Jedno zdarzenie per przejście stanu: requested / plan_ready / completed / failed.
 * Zasila metryki spec docelowej §8 (time-to-first-content, completion rate,
 * honest-failure rate, udział groundingu). Best-effort: błąd zapisu NIGDY nie
 * psuje generacji (log + kontynuacja). Tabela tworzona lazy (wzorzec workCanvas).
 */

import { v4 as uuidv4 } from 'uuid';

import { run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export type DeliverableTelemetryEvent = 'requested' | 'plan_ready' | 'completed' | 'failed';

export interface DeliverableTelemetryInput {
  organizationId: string;
  userId?: string | null;
  generationId: string;
  format: 'deck' | 'doc' | 'sheet';
  event: DeliverableTelemetryEvent;
  durationMs?: number;
  unitCount?: number;
  language?: string;
  /** conversation | source_refs | auto_scan — tryby groundingu ze spec §4. */
  groundingMode?: string;
  error?: string;
}

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = dbRun(
      `CREATE TABLE IF NOT EXISTS deliverables_generation_events (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        user_id TEXT,
        generation_id TEXT NOT NULL,
        format TEXT NOT NULL,
        event_type TEXT NOT NULL,
        duration_ms INTEGER,
        unit_count INTEGER,
        language TEXT,
        grounding_mode TEXT,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ).then(() => undefined);
  }
  return schemaReady;
}

export async function trackDeliverableEvent(input: DeliverableTelemetryInput): Promise<void> {
  try {
    await ensureSchema();
    await dbRun(
      `INSERT INTO deliverables_generation_events
         (id, organization_id, user_id, generation_id, format, event_type,
          duration_ms, unit_count, language, grounding_mode, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        input.organizationId,
        input.userId || null,
        input.generationId,
        input.format,
        input.event,
        typeof input.durationMs === 'number' ? Math.round(input.durationMs) : null,
        typeof input.unitCount === 'number' ? input.unitCount : null,
        input.language || null,
        input.groundingMode || null,
        input.error ? String(input.error).slice(0, 500) : null,
      ]
    );
  } catch (err) {
    logger.warn(
      `[DeliverablesTelemetry] event write failed (${input.event}/${input.format}): ${err instanceof Error ? err.message : err}`
    );
  }
}
