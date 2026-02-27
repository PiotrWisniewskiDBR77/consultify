import { randomUUID } from 'node:crypto';

import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export type OpenRouterMarketSyncResult = {
  success: boolean;
  snapshotId?: string;
  insertedInboxItems?: number;
  limited?: boolean;
  error?: string;
};

function safeJsonParse<T = any>(val: unknown): T | null {
  if (!val) return null;
  try {
    return JSON.parse(String(val)) as T;
  } catch {
    return null;
  }
}

function stableJson(v: any): string {
  try {
    return JSON.stringify(v ?? null);
  } catch {
    return 'null';
  }
}

export async function syncOpenRouterMarket(): Promise<OpenRouterMarketSyncResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return { success: false, error: 'OPENROUTER_API_KEY not configured' };

  try {
    const resp = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!resp.ok) return { success: false, error: `OpenRouter fetch failed: ${resp.status}` };
    const payload: any = await resp.json();

    const snapshotId = randomUUID();
    await dbRun(
      `INSERT INTO ai_market_snapshots (id, source, payload, fetched_at)
       VALUES (?, 'openrouter', ?, CURRENT_TIMESTAMP)`,
      [snapshotId, JSON.stringify(payload)],
      { fallback: false } as any
    );

    // Diff vs previous snapshot.
    let inserted = 0;
    let limited = false;
    try {
      const prev = await dbGet(
        `SELECT payload
         FROM ai_market_snapshots
         WHERE source = 'openrouter' AND id != ?
         ORDER BY fetched_at DESC
         LIMIT 1`,
        [snapshotId],
        { fallback: false } as any
      );
      const prevData = safeJsonParse<any>((prev as any)?.payload);
      const prevList = Array.isArray(prevData?.data)
        ? prevData.data
        : Array.isArray(prevData?.models)
          ? prevData.models
          : [];
      const nextList = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.models)
          ? payload.models
          : [];

      const toMap = (list: any[]) => {
        const m = new Map<string, any>();
        for (const row of list || []) {
          const id = String(row?.id || '').trim();
          if (id) m.set(id, row);
        }
        return m;
      };
      const prevMap = toMap(prevList);
      const nextMap = toMap(nextList);

      const prevIds = new Set(prevMap.keys());
      const nextIds = new Set(nextMap.keys());

      const added = Array.from(nextIds).filter((id) => !prevIds.has(id));
      const removed = Array.from(prevIds).filter((id) => !nextIds.has(id));
      const intersect = Array.from(nextIds).filter((id) => prevIds.has(id));

      const inserts: Array<{ change_type: string; model_id: string; diff: any }> = [];

      for (const id of added) {
        inserts.push({
          change_type: 'MODEL_ADDED',
          model_id: id,
          diff: { after: nextMap.get(id) || { id } },
        });
      }
      for (const id of removed) {
        inserts.push({
          change_type: 'MODEL_REMOVED',
          model_id: id,
          diff: { before: prevMap.get(id) || { id } },
        });
      }

      for (const id of intersect) {
        const before = prevMap.get(id);
        const after = nextMap.get(id);
        if (!before || !after) continue;

        const beforePricing = before?.pricing ?? null;
        const afterPricing = after?.pricing ?? null;
        const beforeCtx = before?.context_length ?? before?.contextLength ?? null;
        const afterCtx = after?.context_length ?? after?.contextLength ?? null;

        if (stableJson(beforePricing) !== stableJson(afterPricing)) {
          inserts.push({
            change_type: 'PRICING_CHANGED',
            model_id: id,
            diff: {
              before: { pricing: beforePricing },
              after: { pricing: afterPricing },
            },
          });
        }
        if (String(beforeCtx ?? '') !== String(afterCtx ?? '')) {
          inserts.push({
            change_type: 'CTX_CHANGED',
            model_id: id,
            diff: {
              before: { context_length: beforeCtx },
              after: { context_length: afterCtx },
            },
          });
        }
      }

      const limitedInserts = inserts.slice(0, 200);
      limited = inserts.length > limitedInserts.length;
      for (const it of limitedInserts) {
        await dbRun(
          `INSERT INTO ai_market_inbox (id, source, change_type, model_id, diff, status, created_at)
           VALUES (?, 'openrouter', ?, ?, ?, 'new', CURRENT_TIMESTAMP)`,
          [randomUUID(), it.change_type, it.model_id, JSON.stringify(it.diff)],
          { fallback: false } as any
        );
        inserted += 1;
      }
    } catch {
      /* ignore diffs */
    }

    return { success: true, snapshotId, insertedInboxItems: inserted, limited };
  } catch (e: any) {
    logger.warn('[OpenRouterMarket] sync failed', { error: e?.message || e });
    return { success: false, error: String(e?.message || e) };
  }
}
