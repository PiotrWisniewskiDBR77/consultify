/**
 * Chat Trace Service
 *
 * Provides persistent tracing / observability for AI chat runs.
 * Each streaming chat interaction creates a "run" that can be annotated with
 * intermediate events (memory injection, web search, RAG, pipeline metadata)
 * and completed/failed when the stream finishes.
 *
 * Uses the `ai_chat_runs` and `ai_chat_run_events` tables when available,
 * falling back to a no-op if the tables haven't been migrated yet.
 */

import { v4 as uuidv4 } from 'uuid';

// Lazy DB helpers to avoid circular imports
let _dbRun: ((...args: unknown[]) => Promise<unknown>) | null = null;

async function getDbRun() {
    if (_dbRun) return _dbRun;
    try {
        const dbModule = await import('../../database/Database.js');
        const db = (dbModule as any).default || dbModule;
        _dbRun = db.dbRun?.bind(db) || db.run?.bind(db) || (async () => { });
        return _dbRun!;
    } catch {
        _dbRun = async () => { };
        return _dbRun;
    }
}

// ---------------------------------------------------------------------------
// Ensure tables exist (idempotent, best-effort)
// ---------------------------------------------------------------------------
let _tablesEnsured = false;

async function ensureTables(): Promise<void> {
    if (_tablesEnsured) return;
    try {
        const dbRun = await getDbRun();
        await dbRun(`
      CREATE TABLE IF NOT EXISTS ai_chat_runs (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        conversation_id TEXT,
        stream_session_id TEXT,
        capability TEXT DEFAULT 'chat',
        status TEXT DEFAULT 'running',
        request_json TEXT,
        context_json TEXT,
        pipeline_trace_id TEXT,
        model_provider TEXT,
        model_id TEXT,
        tier TEXT,
        output_text TEXT,
        dt_states_json TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        completed_at TEXT
      )
    `);
        await dbRun(`
      CREATE TABLE IF NOT EXISTS ai_chat_run_events (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload_json TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (run_id) REFERENCES ai_chat_runs(id)
      )
    `);
        _tablesEnsured = true;
    } catch {
        // Tables may already exist or DB may not be writable in test env
        _tablesEnsured = true;
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CreateRunParams {
    organizationId: string;
    userId: string;
    conversationId?: string | null;
    streamSessionId?: string;
    capability?: string;
    request?: Record<string, unknown>;
    context?: Record<string, unknown>;
}

export interface CompleteRunParams {
    runId: string;
    status?: string;
    pipelineTraceId?: string | null;
    modelProvider?: string | null;
    modelId?: string | null;
    tier?: string | null;
    outputText?: string;
    dtStates?: string[];
}

export interface FailRunParams {
    runId: string;
    error: string;
    pipelineTraceId?: string | null;
    modelProvider?: string | null;
    modelId?: string | null;
    tier?: string | null;
}

/**
 * Create a new chat run and return its ID.
 */
async function createRun(params: CreateRunParams): Promise<{ runId: string }> {
    await ensureTables();
    const runId = uuidv4();
    try {
        const dbRun = await getDbRun();
        await dbRun(
            `INSERT INTO ai_chat_runs (id, organization_id, user_id, conversation_id, stream_session_id, capability, request_json, context_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                runId,
                params.organizationId,
                params.userId,
                params.conversationId || null,
                params.streamSessionId || null,
                params.capability || 'chat',
                JSON.stringify(params.request || {}),
                JSON.stringify(params.context || {}),
            ]
        );
    } catch {
        // best-effort
    }
    return { runId };
}

/**
 * Mark a run as completed (or aborted).
 */
async function completeRun(params: CompleteRunParams): Promise<void> {
    if (!params.runId) return;
    await ensureTables();
    try {
        const dbRun = await getDbRun();
        await dbRun(
            `UPDATE ai_chat_runs
       SET status = ?,
           pipeline_trace_id = COALESCE(?, pipeline_trace_id),
           model_provider = COALESCE(?, model_provider),
           model_id = COALESCE(?, model_id),
           tier = COALESCE(?, tier),
           output_text = ?,
           dt_states_json = ?,
           completed_at = datetime('now')
       WHERE id = ?`,
            [
                params.status || 'completed',
                params.pipelineTraceId || null,
                params.modelProvider || null,
                params.modelId || null,
                params.tier || null,
                params.outputText || null,
                params.dtStates ? JSON.stringify(params.dtStates) : null,
                params.runId,
            ]
        );
    } catch {
        // best-effort
    }
}

/**
 * Mark a run as failed.
 */
async function failRun(params: FailRunParams): Promise<void> {
    if (!params.runId) return;
    await ensureTables();
    try {
        const dbRun = await getDbRun();
        await dbRun(
            `UPDATE ai_chat_runs
       SET status = 'failed',
           error_message = ?,
           pipeline_trace_id = COALESCE(?, pipeline_trace_id),
           model_provider = COALESCE(?, model_provider),
           model_id = COALESCE(?, model_id),
           tier = COALESCE(?, tier),
           completed_at = datetime('now')
       WHERE id = ?`,
            [
                params.error || 'Unknown error',
                params.pipelineTraceId || null,
                params.modelProvider || null,
                params.modelId || null,
                params.tier || null,
                params.runId,
            ]
        );
    } catch {
        // best-effort
    }
}

/**
 * Append an event to a run.
 */
async function addEvent(
    runId: string | null,
    eventType: string,
    payload?: Record<string, unknown>
): Promise<void> {
    if (!runId) return;
    await ensureTables();
    try {
        const dbRun = await getDbRun();
        await dbRun(
            `INSERT INTO ai_chat_run_events (id, run_id, event_type, payload_json) VALUES (?, ?, ?, ?)`,
            [uuidv4(), runId, eventType, JSON.stringify(payload || {})]
        );
    } catch {
        // best-effort
    }
}

export default { createRun, completeRun, failRun, addEvent };
export { createRun, completeRun, failRun, addEvent };
