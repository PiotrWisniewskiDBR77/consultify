#!/usr/bin/env tsx
/**
 * Synthetic load test for Organization Context Engine retrieval surface.
 *
 * What it measures:
 * - p50 / p95 / p99 latency of ContextRetrievalService.retrieveContext over N concurrent calls
 * - error rate
 * - chunk-per-call distribution
 *
 * Configuration via env:
 *   LOADTEST_ORG_ID         - target organization id (must exist in DB)
 *   LOADTEST_USER_ID        - acting user id
 *   LOADTEST_DOC_IDS        - comma-separated document ids
 *   LOADTEST_CONCURRENCY    - default 10
 *   LOADTEST_DURATION_MS    - default 30000ms
 *
 * Source of truth: docs/product/ORGANIZATION_CONTEXT_ENGINE_IMPLEMENTATION_PLAN.md Stage 7 Gate.
 *
 * Exit code: 0 if p95 below ORG_CONTEXT_RETRIEVAL_P95_BUDGET_MS (default 5000ms),
 *            1 otherwise.
 */

import contextRetrievalService from '../src/services/organizationContext/ContextRetrievalService.js';

interface SampleResult {
  durationMs: number;
  chunkCount: number;
  ok: boolean;
  error?: string;
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((sortedAsc.length * p) / 100));
  return sortedAsc[idx];
}

async function singleCall(input: {
  organizationId: string;
  userId: string;
  documentIds: string[];
}): Promise<SampleResult> {
  const start = Date.now();
  try {
    const result = await contextRetrievalService.retrieveContext({
      organizationId: input.organizationId,
      userId: input.userId,
      workflow: 'loadtest',
      workflowMode: 'selected_material_plus_selected_context',
      retrievalQuery: 'load test query for synthetic measurement',
      retrievalReason: 'loadtest',
      selectedDocumentIds: input.documentIds,
      perDocumentChunkLimit: 5,
      totalChunkLimit: 12,
    });
    return {
      durationMs: Date.now() - start,
      chunkCount: result.chunks.length,
      ok: true,
    };
  } catch (err: any) {
    return {
      durationMs: Date.now() - start,
      chunkCount: 0,
      ok: false,
      error: String(err?.message || err),
    };
  }
}

async function main(): Promise<void> {
  const organizationId = process.env.LOADTEST_ORG_ID || '';
  const userId = process.env.LOADTEST_USER_ID || '';
  const documentIds = String(process.env.LOADTEST_DOC_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const concurrency = Math.max(1, Math.min(Number(process.env.LOADTEST_CONCURRENCY || 10), 200));
  const durationMs = Math.max(
    1000,
    Math.min(Number(process.env.LOADTEST_DURATION_MS || 30000), 5 * 60 * 1000)
  );
  const p95Budget = Math.max(
    100,
    Number(process.env.ORG_CONTEXT_RETRIEVAL_P95_BUDGET_MS || 5000)
  );

  if (!organizationId || !userId || documentIds.length === 0) {
    console.error(
      JSON.stringify({
        contract: 'organization_context_engine_loadtest_v1',
        error: 'missing_required_env',
        required: ['LOADTEST_ORG_ID', 'LOADTEST_USER_ID', 'LOADTEST_DOC_IDS'],
      })
    );
    process.exit(1);
  }

  const results: SampleResult[] = [];
  const deadline = Date.now() + durationMs;

  let active = 0;
  let inflight = 0;

  const runOne = async (): Promise<void> => {
    inflight += 1;
    const result = await singleCall({ organizationId, userId, documentIds });
    inflight -= 1;
    results.push(result);
  };

  while (Date.now() < deadline) {
    while (inflight < concurrency && Date.now() < deadline) {
      runOne();
      active += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  while (inflight > 0) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const errors = results.filter((r) => !r.ok);
  const p50 = percentile(durations, 50);
  const p95 = percentile(durations, 95);
  const p99 = percentile(durations, 99);
  const errorRate = results.length === 0 ? 0 : errors.length / results.length;
  const avgChunks =
    results.reduce((acc, r) => acc + r.chunkCount, 0) / Math.max(1, results.length);
  const passed = p95 <= p95Budget && errorRate < 0.01;

  console.log(
    JSON.stringify(
      {
        contract: 'organization_context_engine_loadtest_v1',
        concurrency,
        durationMs,
        attempted: active,
        completed: results.length,
        errors: errors.length,
        errorRate,
        p50,
        p95,
        p99,
        avgChunks,
        p95BudgetMs: p95Budget,
        passed,
        sampleErrors: errors.slice(0, 5).map((e) => e.error),
      },
      null,
      2
    )
  );

  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      contract: 'organization_context_engine_loadtest_v1',
      fatal: String((err as Error)?.message || err),
    })
  );
  process.exit(1);
});
